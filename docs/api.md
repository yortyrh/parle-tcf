# API reference

## Summary

The API (`apps/api`) exposes an [oRPC](https://orpc.unnoq.com/) contract over plain HTTP: **every procedure is `POST` with a JSON body**. The route of each procedure is in `API_ROUTES` (`packages/shared/src/index.ts`), the contract in `apps/api/src/contract/exam.contract.ts`, and every input/output is a Zod schema in `packages/shared/src/schemas`. The web client is `apps/web/lib/api.ts`.

## Authentication

- Send `Authorization: Bearer <token>`. The token comes from the `set-auth-token` response header of Better Auth sign-in calls; cookies are not used for API calls.
- Better Auth itself is mounted at `/api/auth/*` (sign-up, sign-in, sign-out, email verification, password reset, account deletion, OAuth callbacks).
- Unless marked public, a route without a valid bearer token answers `401`.
- Every route is rate-limited per client (`THROTTLE_LIMIT_PER_MINUTE`, default 120/min → `429`).

## Routes

| Route                  | Input → output schema                                                | Purpose                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/exam/session/create` | `createExamSessionInputSchema` → `createExamSessionOutputSchema`     | Start a task: ephemeral credential, instructions, exercise, attempt id (see [exam sessions](./features/exam-sessions.md)) |
| `/exam/session/token`  | `refreshSessionTokenInputSchema` → `refreshSessionTokenOutputSchema` | Fresh credential right before connecting (after preparation); starts the attempt clock                                    |
| `/settings/get`        | `{}` → `providerSettingsSchema`                                      | Provider settings without the key (last 4 characters only)                                                                |
| `/settings/upsert`     | `upsertProviderSettingsInputSchema` → `providerSettingsSchema`       | Save provider, key, models, voice                                                                                         |
| `/settings/delete`     | `{}` → `{ ok: true }`                                                | Forget the provider settings and key                                                                                      |
| `/settings/test`       | `{}` → `testProviderSettingsOutputSchema`                            | Validate the stored key with a minimal provider call                                                                      |
| `/attempts/checkpoint` | `checkpointAttemptInputSchema` → `{ ok, limitReached }`              | Save transcript lines (idempotent by `seq`); tells the client when a limit is reached                                     |
| `/attempts/complete`   | `completeAttemptInputSchema` → `{ ok: true }`                        | Close the attempt once (final lines and token usage), then grade it in the background                                     |
| `/attempts/list`       | `listAttemptsInputSchema` → `listAttemptsOutputSchema`               | Paginated history, filterable by task and mode                                                                            |
| `/attempts/get`        | `attemptIdInputSchema` → `attemptDetailSchema`                       | Attempt with transcript, evaluation and cost                                                                              |
| `/attempts/delete`     | `attemptIdInputSchema` → `{ ok: true }`                              | Delete an attempt (and its recording)                                                                                     |
| `/attempts/reevaluate` | `attemptIdInputSchema` → `{ ok: true }`                              | Requeue a failed (or finished) evaluation                                                                                 |
| `/runs/get`            | `getRunInputSchema` → `examRunSchema`                                | A full exam with its three attempts and overall level                                                                     |
| `/usage/get`           | `{}` → `usageSchema`                                                 | Today's minutes and this month's cost against the caps                                                                    |
| `/audio/status`        | `{}` → `audioStatusSchema`                                           | Whether recording is available and consented                                                                              |
| `/audio/consent`       | `setAudioConsentInputSchema` → `audioStatusSchema`                   | Give or withdraw consent (withdrawing deletes every recording)                                                            |
| `/audio/upload-url`    | `audioUploadInputSchema` → `audioUploadOutputSchema`                 | Presigned, size-capped POST for an attempt's recording                                                                    |
| `/audio/confirm`       | `audioConfirmInputSchema` → `{ ok: true }`                           | Link the uploaded recording after checking it exists                                                                      |
| `/audio/download-url`  | `attemptIdInputSchema` → `audioDownloadOutputSchema`                 | Short-lived playback URL                                                                                                  |
| `/exercises/list`      | `listExercisesInputSchema` → `listExercisesOutputSchema`             | Topic browser: subjects by task, month and search text                                                                    |
| `/exercises/sessions`  | `{}` → `listExerciseSessionsOutputSchema`                            | Months with published subjects                                                                                            |
| `/exercises/featured`  | `{}` → `featuredExercisesOutputSchema`                               | **Public.** Landing page teaser (a few subjects of the latest month)                                                      |

Non-oRPC routes:

| Route                       | Purpose                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /health`               | **Public.** Liveness probe (Railway, Docker)                                                          |
| `GET /auth/oauth/:provider` | **Public.** Starts GitHub/Google sign-in                                                              |
| `GET /auth/oauth/complete`  | **Public.** OAuth landing on the API: swaps the session for a one-time code, redirects to the web app |
| `POST /auth/oauth/exchange` | **Public.** Exchanges the one-time code for the bearer token                                          |

## Errors

oRPC errors carry a `code` and a French `message` meant for the user.

| Code                        | HTTP      | When                                                                            |
| --------------------------- | --------- | ------------------------------------------------------------------------------- |
| `PROVIDER_NOT_CONFIGURED`   | 4xx       | The user has no provider key yet (the UI sends them to Paramètres)              |
| `PROVIDER_KEY_REJECTED`     | 422       | The provider refused the user's key while minting                               |
| `BAD_GATEWAY`               | 502       | The provider failed while minting                                               |
| `LIMIT_REACHED`             | 4xx       | Daily minutes or monthly cost cap reached                                       |
| `NOT_FOUND`                 | 404       | Unknown id, **or a row owned by another user** (never distinguishable)          |
| `CONFLICT`                  | 409       | Attempt already finished, provider changed mid-task, evaluation already running |
| `BAD_REQUEST` / `FORBIDDEN` | 400 / 403 | Invalid input or a forbidden action                                             |

## Adding a route

Run `pnpm scaffold:api-feature <kebab-name>`: it creates the Nest module, service and controller, the shared Zod schemas, the `API_ROUTES` entry and the contract procedure. Then add an integration spec and, for any query, a cross-user test.
