import { inject } from 'vitest';

interface MailpitSummary {
  ID: string;
  To: { Address: string }[];
  Subject: string;
  Created: string;
}

/** Mailpit REST client for the integration tests. */
export async function messagesTo(address: string): Promise<MailpitSummary[]> {
  const res = await fetch(
    `${inject('mailpitUrl')}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`
  );
  const body = (await res.json()) as { messages: MailpitSummary[] };
  return body.messages;
}

/** Waits for the newest email sent to `address` and returns its HTML body. */
export async function latestEmailTo(address: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [latest] = await messagesTo(address);
    if (latest) {
      const res = await fetch(`${inject('mailpitUrl')}/api/v1/message/${latest.ID}`);
      const message = (await res.json()) as { HTML: string; Text: string };
      return message.HTML || message.Text;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`No email to ${address} within ${timeoutMs} ms`);
}

/** Every http(s) link of an email body. */
export function linksIn(body: string): string[] {
  return [...body.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0].replaceAll('&amp;', '&'));
}
