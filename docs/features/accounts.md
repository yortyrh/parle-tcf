# Accounts and authentication

## Summary

Accounts with email and password, or GitHub/Google sign-in, handled by Better Auth inside the API. Email verification, password reset and account deletion work through email links that open web pages. The web app is on another site than the API, so it authenticates with a bearer token, never with cookies.

## User flow

| Page                  | Route                  | Purpose                                                       |
| --------------------- | ---------------------- | ------------------------------------------------------------- |
| Inscription           | `/inscription`         | Sign up (email, password, name); a verification email follows |
| Vérifier l'email      | `/verifier-email`      | Landing page of the verification link                         |
| Connexion             | `/connexion`           | Sign in with email/password, GitHub or Google                 |
| Retour OAuth          | `/connexion/retour`    | Finishes social sign-in                                       |
| Mot de passe oublié   | `/mot-de-passe-oublie` | Request a reset email                                         |
| Réinitialiser         | `/reinitialiser`       | Set a new password from the email link                        |
| Suppression du compte | `/compte/suppression`  | Confirm account deletion from the email link                  |

## How it works

- Better Auth is mounted at `/api/auth/*` with the `bearer()` plugin. The web app stores the token from the `set-auth-token` header in `localStorage` (`apps/web/lib/session-token.ts`) and sends `Authorization: Bearer`. `SessionAuthGuard` accepts bearer tokens only.
- Email verification is required to sign in (`AUTH_EMAIL_VERIFICATION_ENABLED`, can be turned off for local development only).
- **Social sign-in hand-off:** `GET /auth/oauth/:provider` → provider → `GET /auth/oauth/complete` on the API, where the session exists only as an API-site cookie. The API swaps it for a one-time code (stored in `verification`, valid 2 minutes, single use) and redirects to `/connexion/retour`, which exchanges it with `POST /auth/oauth/exchange` for the bearer token.
- Redirect targets are checked (`safe-redirect`) on both sides to avoid open redirects.
- **Account deletion** requires the confirmation email. Before the user row is deleted, the API removes every audio recording; database rows (settings, attempts, transcripts, evaluations, preferences) go with the user through cascading foreign keys.

## Configuration

`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_URL`, `AUTH_EMAIL_VERIFICATION_ENABLED`, `GITHUB_CLIENT_ID`/`SECRET`, `GOOGLE_CLIENT_ID`/`SECRET` (API); `NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED`, `NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED` (web, written by `pnpm setup:env`).

Local social sign-in needs real development apps:

1. GitHub: _Settings → Developer settings → OAuth Apps → New_. Homepage `http://localhost:3000`, callback `http://localhost:3001/api/auth/callback/github`.
2. Google: _Google Cloud console → APIs & Services → Credentials → OAuth client ID (Web)_. Redirect URI `http://localhost:3001/api/auth/callback/google`.
3. Put the ids and secrets in `apps/api/.env`, then run `pnpm setup:env` again: it keeps them and turns the matching buttons on.

## Code map

`apps/api/src/auth/` (Better Auth instance, guard, OAuth controller and hand-off), `apps/web/app/(auth)/`, `apps/web/lib/{auth-client,session-token,oauth,safe-redirect}.ts`, `packages/email-templates`.

## Tests

`better-auth.spec.ts`, `session-auth.guard.spec.ts`, `oauth-handoff.service.spec.ts`, `oauth.controller.spec.ts`, `apps/api/test/integration/{auth,guard,isolation,account-deletion}.spec.ts`, `apps/e2e/tests/{auth,signup,account-deletion}.spec.ts`.
