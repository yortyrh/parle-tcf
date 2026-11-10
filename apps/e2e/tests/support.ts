import AxeBuilder from '@axe-core/playwright';
import { type Page, expect } from '@playwright/test';
import { MAILPIT_URL } from '../playwright.config';

/** WCAG 2.1 AA violations on the current page (serious and critical only fail). */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** A fresh address per test run. */
export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@parle-tcf.test`;
}

/** First link of the newest email sent to `address` whose URL contains `fragment`. */
export async function emailLink(
  address: string,
  fragment: string,
  timeoutMs = 15_000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`
    );
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages[0]) {
      const msg = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)
      ).json()) as {
        HTML: string;
        Text: string;
      };
      const links = [...(msg.HTML || msg.Text).matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) =>
        m[0].replaceAll('&amp;', '&')
      );
      const link = links.find((l) => l.includes(fragment));
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`No email to ${address} with a "${fragment}" link`);
}
