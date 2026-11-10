import { type ComponentType, createElement } from 'react';
import { render } from '@react-email/render';
import DeleteAccount, {
  type DeleteAccountProps,
  deleteAccountSubject,
} from './templates/delete-account';
import ResetPassword, {
  type ResetPasswordProps,
  resetPasswordSubject,
} from './templates/reset-password';
import VerifyEmail, { type VerifyEmailProps, verifyEmailSubject } from './templates/verify-email';

export type { DeleteAccountProps, ResetPasswordProps, VerifyEmailProps };

/** Props of every template, keyed by name. Add a template here and in `TEMPLATES`. */
export interface EmailTemplateProps {
  'verify-email': VerifyEmailProps;
  'reset-password': ResetPasswordProps;
  'delete-account': DeleteAccountProps;
}

export type EmailTemplateName = keyof EmailTemplateProps;

interface TemplateEntry<P> {
  component: ComponentType<P>;
  subject: (props: P) => string;
}

const TEMPLATES: {
  [K in EmailTemplateName]: TemplateEntry<EmailTemplateProps[K]>;
} = {
  'verify-email': { component: VerifyEmail, subject: verifyEmailSubject },
  'reset-password': { component: ResetPassword, subject: resetPasswordSubject },
  'delete-account': { component: DeleteAccount, subject: deleteAccountSubject },
};

export const EMAIL_TEMPLATE_NAMES = ['verify-email', 'reset-password', 'delete-account'] as const;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Renders a template to a subject, an HTML body and a plain-text body. */
export async function renderEmail<K extends EmailTemplateName>(
  name: K,
  props: EmailTemplateProps[K]
): Promise<RenderedEmail> {
  const entry = (TEMPLATES as Record<string, TemplateEntry<EmailTemplateProps[K]> | undefined>)[
    name
  ];
  if (!entry) throw new Error(`Unknown email template "${String(name)}"`);
  const element = createElement(entry.component, props);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: entry.subject(props), html, text };
}
