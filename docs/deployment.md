# Deployment

## Summary

Two services built from the repository root with their Dockerfiles: the **API** (`apps/api/Dockerfile`, NestJS) and the **web app** (`apps/web/Dockerfile`, Next.js standalone). An optional third service runs the exercise importer as a cron job (`packages/importer/Dockerfile`). All images use Node.js 26 (LTS) and pnpm 12, and prune the monorepo with `turbo prune --docker`.

## Docker Compose (single machine)

```bash
cp .env.example .env
# Set BETTER_AUTH_SECRET, ENCRYPTION_KEYS (v1:<base64 of 32 bytes>) and ENCRYPTION_KEY_CURRENT
docker compose up -d --build
```

- Web on http://localhost (host port 80 → container 3000); API on http://localhost:3001 (`/health`).
- A one-shot `migrate` service applies the migrations and fills an empty exercise bank (private bank with `EXERCISE_DATA_TOKEN`, sample bank otherwise) before the API starts.
- The web image inlines `NEXT_PUBLIC_EXAM_API_URL` at build time (build args in `docker-compose.yml`).

More details: [`DOCKER.md`](../DOCKER.md).

## Railway

Two services from the same repository, root directory empty (monorepo root):

| Service | Config file             | Notes                                                                                                                                |
| ------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| API     | `apps/api/railway.json` | Pre-deploy applies migrations, then fills an empty exercise bank from the private data repository (`EXERCISE_DATA_TOKEN`); `/health` |
| Web     | `apps/web/railway.json` | Needs the API's public URL at build time                                                                                             |

Order: deploy the **API**, set the web service's `NEXT_PUBLIC_EXAM_API_URL` to its public URL and deploy the **web** app, then set the API's `CORS_ORIGINS` to the web URL. Rebuild the web app whenever the API URL changes (Next.js inlines it at build time).

`pnpm deploy:railway [all|api|web] [--check]` runs the guards and the configuration check, deploys the API then the web app, and waits for the health probes. Pushing to GitHub does **not** deploy: the services have no deploy triggers on purpose (a push would otherwise run production migrations).

## Environment variables

Every API variable is documented in `apps/api/.env.example` (`pnpm env-schema:check` fails otherwise) and validated at boot by `apps/api/src/config/env.ts`. The main ones:

| Variable                                             | Required    | Description                                                                            |
| ---------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                       | Yes         | PostgreSQL connection string                                                           |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `WEB_URL` | Yes         | Auth secret (32+ chars), public API URL, public web URL                                |
| `ENCRYPTION_KEYS` / `ENCRYPTION_KEY_CURRENT`         | Yes         | Master keys for users' provider API keys (`v1:<base64 32 bytes>`)                      |
| `RESEND_API_KEY` or `SMTP_URL`, and `MAIL_FROM`      | Yes in prod | Transactional email; production refuses to start without a transport                   |
| `CORS_ORIGINS`                                       | Yes in prod | Web origins allowed to call the API                                                    |
| `GITHUB_*` / `GOOGLE_*`                              | No          | OAuth providers (client id and secret)                                                 |
| `OPENAI_REALTIME_MODEL` / `GEMINI_LIVE_MODEL`        | No          | Default voice models (built-in: `gpt-realtime-2.1-mini`, `gemini-3.8-live`)            |
| `DEFAULT_DAILY_MINUTES` / `DEFAULT_MONTHLY_COST_USD` | No          | Usage caps per user (defaults 60 min/day, 10 USD/month)                                |
| `S3_*`                                               | No          | Audio recording storage; unset disables recording                                      |
| `EXERCISE_DATA_TOKEN`                                | New envs    | Read-only token for the private exercise bank, loaded into an empty bank at pre-deploy |
| `THROTTLE_LIMIT_PER_MINUTE`                          | No          | Requests per minute per client before HTTP 429 (default 120)                           |

Web build-time variables (`apps/web/.env.example`): `NEXT_PUBLIC_EXAM_API_URL` (required), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED`, `NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED`.

## Operations

- **Master key rotation:** add `v2` to `ENCRYPTION_KEYS`, switch `ENCRYPTION_KEY_CURRENT=v2`, run `pnpm --filter @parle-tcf/api rotate-keys`, then remove `v1`.
- **Stale work:** a sweeper (boot, then every 5 minutes) marks silent in-progress attempts `interrupted` and stuck evaluations `failed` (they can be requeued).
- **Logs:** structured JSON (pino) with secret redaction.
