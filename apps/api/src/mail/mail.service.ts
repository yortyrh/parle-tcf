import { Injectable, Logger } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { getEnv } from "../config/env.js";

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Transactional email over SMTP (`SMTP_URL`, e.g. Mailpit locally). Without a
 * transport the message is only logged, which is enough for local development.
 * Mail bodies are in French like the rest of the candidate-facing UI.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private transport(): Transporter | null {
    const { SMTP_URL } = getEnv();
    if (!SMTP_URL) return null;
    this.transporter ??= createTransport(SMTP_URL);
    return this.transporter;
  }

  async send(mail: OutgoingMail): Promise<void> {
    const transport = this.transport();
    if (!transport) {
      this.logger.log(
        `[mail] to=${mail.to} subject="${mail.subject}"\n${mail.text}`,
      );
      return;
    }
    await transport.sendMail({ from: getEnv().MAIL_FROM, ...mail });
  }

  sendVerificationEmail(to: string, url: string): Promise<void> {
    return this.send(
      actionMail(
        to,
        "Confirmez votre adresse e-mail",
        [
          "Bienvenue sur parle-tcf !",
          "Confirmez votre adresse e-mail pour activer votre compte.",
        ],
        "Confirmer mon e-mail",
        url,
      ),
    );
  }

  sendPasswordResetEmail(to: string, url: string): Promise<void> {
    return this.send(
      actionMail(
        to,
        "Réinitialisation de votre mot de passe",
        [
          "Vous avez demandé à réinitialiser votre mot de passe.",
          "Ce lien est valable une heure. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
        ],
        "Choisir un nouveau mot de passe",
        url,
      ),
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function actionMail(
  to: string,
  subject: string,
  paragraphs: string[],
  cta: string,
  url: string,
): OutgoingMail {
  const text = `${paragraphs.join("\n\n")}\n\n${cta} : ${url}\n`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px">${paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("")}<p><a href="${escapeHtml(url)}">${escapeHtml(cta)}</a></p></div>`;
  return { to, subject, text, html };
}
