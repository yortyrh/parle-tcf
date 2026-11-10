/**
 * Mail transport selection (no env switch: the settings present decide).
 *
 * 1. `RESEND_API_KEY`: HTTPS API (Railway and similar hosts block outbound SMTP).
 * 2. `SMTP_URL`: nodemailer (Mailpit locally, any SMTP relay in production).
 * 3. Neither: messages are only logged. Refused in production at startup.
 */
export type MailTransport =
  | { kind: 'resend'; apiKey: string }
  | { kind: 'smtp'; url: string }
  | { kind: 'log' };

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function resolveMailTransport(env: {
  NODE_ENV: string;
  RESEND_API_KEY?: string;
  SMTP_URL?: string;
}): MailTransport {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (apiKey) return { kind: 'resend', apiKey };
  const url = env.SMTP_URL?.trim();
  if (url) return { kind: 'smtp', url };
  return { kind: 'log' };
}

export function assertTransportAllowed(transport: MailTransport, nodeEnv: string): void {
  if (transport.kind === 'log' && nodeEnv === 'production') {
    throw new Error(
      '[MailService] A mail transport is required in production: set RESEND_API_KEY or SMTP_URL.'
    );
  }
}

export const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export async function sendWithResend({
  apiKey,
  from,
  mail,
  fetchImpl = fetch,
}: {
  apiKey: string;
  from: string;
  mail: OutgoingMail;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend rejected the email (HTTP ${response.status}): ${detail}`);
  }
}
