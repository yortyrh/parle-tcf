# API integration suite

Supertest against the real `AppModule` (same HTTP setup as `main.ts` through `configureApp`),
Postgres 17 and Mailpit in Testcontainers, the real migrations (exercise bank included) and the
`VOICE_PROVIDER=fake` stand-ins (`src/providers/fake-voice.provider.ts`,
`src/evaluation/fake-language-model.ts`). No S3.

```sh
cd apps/api && pnpm test:integration   # Docker or Podman required, ~20 s boot
```

- `global-setup.ts`: containers + migrations, provides `databaseUrl`, `smtpUrl`, `mailpitUrl`.
- `create-test-app.ts`: `createTestApp()` → `{ app, http(), db, close }`. One app per spec file.
- `mailpit.ts`: `messagesTo`, `latestEmailTo`, `linksIn`.
- `helpers.ts`: `uniqueEmail`, `signUpVerifiedUser` (sign-up, verified in the DB, bearer token),
  `rpc` (POST JSON like the web app), `expectError`, `ok`, `configureProvider`, `startSession`,
  `waitForEvaluation`, `webLinkInEmail`.

Files share one database and run one after the other; every test uses fresh users, so no spec
depends on another one or on the order.

## Contracts pinned by each spec

### `auth.spec.ts`: Better Auth under `/api/auth`, OAuth handoff

| Route                                   | Behaviour                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/auth/sign-up/email`          | 200 without session (`token: null`, no `set-auth-token`); user stored unverified                                                                 |
| (Mailpit)                               | the verification email links to `WEB_URL/verifier-email?token=…`                                                                                 |
| `POST /api/auth/sign-in/email`          | 403 before verification; 401 on a wrong password; 200 + `set-auth-token` once verified                                                           |
| `GET /api/auth/verify-email`            | verifies and signs in (`set-auth-token`); a forged token fails and verifies nothing                                                              |
| `GET /api/auth/get-session`             | resolves the bearer token to the user                                                                                                            |
| any protected route                     | a session cookie alone is 401: bearer only                                                                                                       |
| `POST /api/auth/request-password-reset` | 200 and a `WEB_URL/reinitialiser?token=…` email; 200 and no email for an unknown address                                                         |
| `POST /api/auth/reset-password`         | sets the new password, the old one fails, sessions opened before are revoked; forged → 4xx                                                       |
| `POST /auth/oauth/exchange`             | one-time code → the session token, which works as bearer; single use (row deleted); expired / unknown → 401; missing, empty or > 200 chars → 400 |
| `GET /auth/oauth/:provider`             | 404 for a provider without credentials                                                                                                           |
| `GET /auth/oauth/complete`              | no session → 302 to `WEB_URL/connexion?erreur=oauth`                                                                                             |

### `guard.spec.ts`: `SessionAuthGuard`

| Route                                            | Behaviour                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| every `API_ROUTES` entry but `exercisesFeatured` | 401 without token, with an unknown token, and with a non-bearer scheme; with a valid token never 401/404 |
| `POST /exercises/featured`, `GET /health`        | public                                                                                                   |

### `isolation.spec.ts`: someone else's resources are `NOT_FOUND` and unchanged

| Route                 | Behaviour                                                       |
| --------------------- | --------------------------------------------------------------- |
| `attempts.get`        | 404, same answer as a random id                                 |
| `attempts.list`       | only the caller's attempts                                      |
| `attempts.delete`     | 404, attempt still there                                        |
| `attempts.checkpoint` | 404, no line added                                              |
| `attempts.complete`   | 404, attempt still in progress                                  |
| `attempts.reevaluate` | 404, evaluation status unchanged                                |
| `runs.get`            | 404                                                             |
| `exam.session.create` | full mode with another user's `runId` → 404, no attempt created |
| `exam.session.token`  | 404, attempt clock not restarted                                |
| `audio.downloadUrl`   | 404; consent is per user                                        |
| `settings.*`          | per user; the key is never returned                             |

### `session.spec.ts`: `exam.session.create`, `exam.session.token`

| Route                 | Behaviour                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exam.session.create` | no key → 412 `PROVIDER_NOT_CONFIGURED`, nothing created                                                                                                                                                                         |
|                       | BYOK: the stored key is encrypted, decrypted to mint (`fake-client-secret:<provider>:<key length>`); OpenAI defaults `gpt-realtime-2.1-mini`/`marin`, Gemini `gemini-3.8-live`, Gemini voice `Puck`; the user's model/voice win |
|                       | in-progress attempt with provider, model, task, `t1-entretien` for tâche 1                                                                                                                                                      |
|                       | tâche 2/3: requested subject + ordered ids of that task; random subject of the task otherwise; unknown id or another task's id → 404, nothing created; tâche 1 has no navigation; bad task → 400                                |
|                       | full mode creates a run and reuses it; practice ignores `runId`                                                                                                                                                                 |
|                       | daily minutes (1.99/2 allowed, 2/2 refused) and monthly cost (0.4999/0.50 allowed, 0.50 refused) → 429 `LIMIT_REACHED`, nothing created; other users' usage does not count                                                      |
| `exam.session.token`  | fresh secret and the attempt clock restarts; finished attempt → 409; provider switched → 409; limit reached → 429; key removed → 412; unknown attempt → 404                                                                     |

### `attempts.spec.ts`: attempts, evaluation, usage

| Route                 | Behaviour                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attempts.checkpoint` | idempotent by `seq` (replays and overlaps keep one line, latest text); records activity; ignored after completion; `limitReached: true` once the live session uses up the day; invalid lines → 400 |
| `attempts.complete`   | duration and cost computed by the server (client `durationS` ignored); idempotent (second call changes nothing, one evaluation)                                                                    |
| evaluation (fake)     | done, B1 on every criterion, candidate lines echoed as corrections; no candidate speech → failed                                                                                                   |
| `attempts.reevaluate` | failed → queued → done; running → 409 and untouched; in progress → 404                                                                                                                             |
| `runs.get`            | the three graded tasks of a full run set its level (B1) and `finishedAt`; a missing task leaves both null                                                                                          |
| `attempts.list`       | newest first, `task` and `mode` filters, pagination with the total; `limit > 100` → 400                                                                                                            |
| `attempts.delete`     | deletes the attempt and its transcript; then get/delete → 404                                                                                                                                      |
| `usage.get`           | today's minutes and month's cost against the user's limits, env defaults (60 min, 10 $) otherwise                                                                                                  |

### `exercises.spec.ts`

| Route                | Behaviour                                                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exercises.sessions` | months newest first with per-task counts                                                                                                                                                                                                 |
| `exercises.list`     | per task, 20 by default; month filter matches the occurrences and the month count; search is case- and accent-insensitive and treats `%`/`_` literally; disjoint pages; task 1, `limit > 100`, negative offset, search > 100 chars → 400 |
| `exercises.featured` | public; latest month, up to 3 subjects per task, tâche 2 first, all from that month; same answer with or without token                                                                                                                   |

### `settings.spec.ts` (fake provider)

| Route             | Behaviour                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.get`    | unconfigured defaults; never the key, only `last4`                                                                                                                          |
| `settings.upsert` | stores the key encrypted (`v1`); first configuration needs a key; models/voice update keeps the key; switching provider needs a new key; prefix mismatch or short key → 400 |
| `settings.test`   | ok → `verifiedAt` set; key containing "invalid" → `{ ok: false }`, not verified; a new key resets `verifiedAt`; no key → 412                                                |
| `settings.delete` | removes the row; idempotent                                                                                                                                                 |

### `audio.spec.ts` (no S3 configured)

| Route                              | Behaviour                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio.status`                     | `available: false`, consent false by default                                                                                                |
| `audio.setConsent`                 | stores and withdraws consent                                                                                                                |
| `audio.uploadUrl`, `audio.confirm` | 400 `BAD_REQUEST` "L'enregistrement audio n'est pas disponible sur ce serveur." (presign constraints: `src/audio/s3-audio-storage.spec.ts`) |
| `audio.downloadUrl`                | `{ url: null }` without recording; unknown attempt → 404                                                                                    |
| `attempts.delete`                  | works without storage                                                                                                                       |

### `account-deletion.spec.ts`

| Route                                | Behaviour                                                                                                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/delete-user`         | emails `WEB_URL/compte/suppression?token=…`; deletes nothing yet                                                                                                                                                                                |
| `GET /api/auth/delete-user/callback` | with the account's bearer: user, sessions, settings, preferences, limits, runs, attempts, transcripts and evaluations gone, token now 401, other users untouched; without a session or with another account's session: refused, nothing deleted |

### `importer.spec.ts`: `packages/importer` `importSession` on the app's database

| Behaviour                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| inserts a month; replaying it only matches; a subject republished next month (whitespace differs) reuses the row and widens `firstSeenOn`/`lastSeenOn`; one occurrence per publication |
| the imported month is served by `exercises.sessions` (newest) and `exercises.list` (`timesPublished`); the spec removes its rows afterwards                                            |
