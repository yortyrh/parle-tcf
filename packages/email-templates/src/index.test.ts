import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATE_NAMES, renderEmail } from "./index";

const URL_WITH_QUERY =
  "https://app.parle-tcf.test/verify?token=abc123&callbackURL=%2Ftcf";
const URL_ESCAPED =
  "https://app.parle-tcf.test/verify?token=abc123&amp;callbackURL=%2Ftcf";
const HOSTILE_URL =
  "https://app.parle-tcf.test/reset?token=<script>alert(1)</script>";
const TAG_RE = /<[a-z][^>]*>/i;

const SUBJECTS = {
  "verify-email": "Confirmez votre adresse e-mail",
  "reset-password": "Réinitialisation de votre mot de passe",
  "delete-account": "Confirmez la suppression de votre compte",
} as const;

describe("EMAIL_TEMPLATE_NAMES", () => {
  it("lists the templates in order", () => {
    expect(EMAIL_TEMPLATE_NAMES).toEqual([
      "verify-email",
      "reset-password",
      "delete-account",
    ]);
  });
});

describe.each(EMAIL_TEMPLATE_NAMES)("renderEmail(%s)", (name) => {
  it("uses the French subject", async () => {
    const { subject } = await renderEmail(name, { url: URL_WITH_QUERY });
    expect(subject).toBe(SUBJECTS[name]);
  });

  it("renders a French HTML document with the escaped link", async () => {
    const { html } = await renderEmail(name, { url: URL_WITH_QUERY });
    expect(html).toMatch(/^<!DOCTYPE html/i);
    expect(html).toContain('lang="fr"');
    expect(html).toContain("parle-tcf");
    expect(html).toContain(`href="${URL_ESCAPED}"`);
  });

  it("renders a plain-text version with the raw link and no tags", async () => {
    const { text } = await renderEmail(name, { url: URL_WITH_QUERY });
    expect(text).toContain(URL_WITH_QUERY);
    expect(text).not.toMatch(TAG_RE);
    expect(text.trim().length).toBeGreaterThan(URL_WITH_QUERY.length);
  });

  it("never emits an unescaped <script> from the url", async () => {
    const { html } = await renderEmail(name, { url: HOSTILE_URL });
    expect(html.toLowerCase()).not.toContain("<script>");
  });

  it("puts the given url in the output, not a fixed one", async () => {
    const other = "https://other.test/x?y=1";
    const { html, text } = await renderEmail(name, { url: other });
    expect(html).toContain(`href="${other}"`);
    expect(text).toContain(other);
    expect(html).not.toContain(URL_ESCAPED);
  });
});

describe("renderEmail", () => {
  it("gives each template a distinct subject and body", async () => {
    const rendered = await Promise.all(
      EMAIL_TEMPLATE_NAMES.map((name) =>
        renderEmail(name, { url: URL_WITH_QUERY }),
      ),
    );
    expect(new Set(rendered.map((r) => r.subject)).size).toBe(3);
    expect(new Set(rendered.map((r) => r.html)).size).toBe(3);
    expect(new Set(rendered.map((r) => r.text)).size).toBe(3);
  });

  it("rejects an unknown template with its name in the message", async () => {
    const render = renderEmail as unknown as (
      name: string,
      props: { url: string },
    ) => Promise<unknown>;
    const promise = render("no-such-template", { url: URL_WITH_QUERY });
    await expect(promise).rejects.toBeInstanceOf(Error);
    await expect(promise).rejects.toThrow(/no-such-template/);
  });
});
