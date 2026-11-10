import { createTransport } from 'nodemailer';
import { Inject, Injectable, Logger, type OnModuleInit, Optional } from '@nestjs/common';
import {
  type EmailTemplateName,
  type EmailTemplateProps,
  renderEmail,
} from '@parle-tcf/email-templates';
import { getEnv } from '../config/env.js';
import {
  type OutgoingMail,
  assertTransportAllowed,
  resolveMailTransport,
  sendWithResend,
} from './mail-transport.js';

export type { OutgoingMail } from './mail-transport.js';

interface SmtpSender {
  sendMail(message: OutgoingMail & { from: string }): Promise<unknown>;
}

/** Optional overrides for tests; not provided in the app, so the defaults apply. */
export const MAIL_SERVICE_DEPS = Symbol('MAIL_SERVICE_DEPS');

export interface MailServiceDeps {
  fetchImpl?: typeof fetch;
  smtpFactory?: (url: string) => SmtpSender;
}

/**
 * Transactional email rendered from `@parle-tcf/email-templates` (French, like the
 * candidate UI) and sent through Resend, SMTP or the log (see mail-transport.ts).
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly fetchImpl: typeof fetch;
  private readonly smtpFactory: (url: string) => SmtpSender;
  private smtp: { url: string; sender: SmtpSender } | null = null;

  constructor(@Optional() @Inject(MAIL_SERVICE_DEPS) deps: MailServiceDeps = {}) {
    this.fetchImpl = deps?.fetchImpl ?? ((...args) => fetch(...args));
    this.smtpFactory = deps?.smtpFactory ?? ((url) => createTransport(url));
  }

  onModuleInit(): void {
    const env = getEnv();
    assertTransportAllowed(resolveMailTransport(env), env.NODE_ENV);
  }

  async send<K extends EmailTemplateName>(
    template: K,
    to: string,
    props: EmailTemplateProps[K]
  ): Promise<void> {
    const env = getEnv();
    const { subject, html, text } = await renderEmail(template, props);
    const mail: OutgoingMail = { to, subject, html, text };
    const transport = resolveMailTransport(env);
    switch (transport.kind) {
      case 'resend':
        await sendWithResend({
          apiKey: transport.apiKey,
          from: env.MAIL_FROM,
          mail,
          fetchImpl: this.fetchImpl,
        });
        return;
      case 'smtp':
        await this.smtpSender(transport.url).sendMail({
          from: env.MAIL_FROM,
          ...mail,
        });
        return;
      case 'log':
        this.logger.log(`[mail] to=${to} subject="${subject}"\n${text}`);
        return;
    }
  }

  private smtpSender(url: string): SmtpSender {
    if (this.smtp?.url !== url) this.smtp = { url, sender: this.smtpFactory(url) };
    return this.smtp.sender;
  }

  sendVerificationEmail(to: string, url: string): Promise<void> {
    return this.send('verify-email', to, { url });
  }

  sendPasswordResetEmail(to: string, url: string): Promise<void> {
    return this.send('reset-password', to, { url });
  }

  sendDeleteAccountEmail(to: string, url: string): Promise<void> {
    return this.send('delete-account', to, { url });
  }
}
