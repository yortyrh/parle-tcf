# Website, privacy and email

## Summary

The public side of the app: a French landing page, a privacy page, SEO metadata, and the transactional emails.

## User flow

- **Landing page** (`/`): what the app does, the three tasks with their timing, the evaluation criteria, an indicative cost per task, a few subjects of the latest month (public API), an illustrated demo loop, and sign-in/sign-up links (or a link to the app when a session is stored).
- **Privacy** (`/confidentialite`): what is stored (account, attempts with transcript and evaluation, encrypted API key), how audio is handled (sent live to the provider; stored only with consent), third-party providers, the user's rights (delete an attempt, the key or the account) and a disclaimer.
- A non-affiliation notice: parle-tcf is not affiliated with France Éducation international, and levels are estimates.

## How it works

- SEO: `app/opengraph-image.tsx`, `app/robots.ts`, `app/sitemap.ts`, canonical URLs from `NEXT_PUBLIC_SITE_URL`.
- Emails: React Email templates in `packages/email-templates` (verification, password reset, account deletion), sent with `MailService.send(template, to, props)`. Transport priority: `RESEND_API_KEY` (HTTPS, for hosts that block SMTP) > `SMTP_URL` > log only (refused in production). Preview: `pnpm --filter @parle-tcf/email-templates preview`.
- Locally every email lands in Mailpit (http://localhost:8025).

## Code map

`apps/web/app/(marketing)/`, `apps/web/components/marketing/`, `apps/api/src/mail/`, `packages/email-templates/`.

## Tests

`apps/web/components/marketing/*.test.tsx`, `mail.service.spec.ts`, `mail-transport.spec.ts`, `packages/email-templates/src/index.test.ts`, `apps/e2e/tests/mobile.spec.ts` (axe checks).
