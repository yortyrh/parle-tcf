# parle-tcf — TCF speaking practice

Monorepo (Turborepo + pnpm) for practising the **speaking test (expression orale) of the TCF** with an AI examiner. Voice runs over **OpenAI Realtime via direct WebRTC in the browser** (`@openai/agents`). A **NestJS API** mints the ephemeral `client_secret` and serves the exercise bank (PostgreSQL) and the YAML prompts.

> **Not official.** parle-tcf is an independent practice tool. It is not affiliated with, endorsed by, or connected to France Éducation international, and any level it shows is an estimate, not a TCF score.

## Project layout

| Package                 | Role                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **`apps/web`**          | Next.js 15 — candidate UI, auth, Realtime session, results, history and progression.                                          |
| **`apps/api`**          | NestJS — Better Auth, encrypted per-user API keys, `client_secrets`, attempts, CEFR evaluation, usage limits (oRPC contract). |
| **`packages/importer`** | Imports monthly subjects into the exercise bank (Railway cron).                                                               |
| **`packages/db`**       | Drizzle schema and migrations, including the exercise bank data (PostgreSQL).                                                 |
| **`packages/shared`**   | Task types and Zod schemas for the session contract — `tsc` build → `dist/`.                                                  |

## Quick start (Docker Compose)

### Prerequisites

- Docker & Docker Compose
- An **OpenAI** (or, experimentally, **Google Gemini**) API key per user, entered in the app (stored encrypted)

### Configuration

```bash
cp .env.example .env
# Set BETTER_AUTH_SECRET, ENCRYPTION_KEYS (v1:<base64 of 32 bytes>) and ENCRYPTION_KEY_CURRENT
```

### Run

```bash
docker compose up -d --build
```

- Web: **http://localhost** (host port 80 → container 3000).
- API: **http://localhost:3001** (health: `/health`).

The web image is built with `NEXT_PUBLIC_EXAM_API_URL` (see `docker-compose.yml` build args). The default targets `http://localhost:3001` so the browser on your machine can reach the API.

---

## Railway

Use **two** Railway services from the **same** Git repo: **API** (NestJS) and **Web** (Next.js). The Realtime examiner runs **in the browser** over WebRTC; the API only mints secrets and serves exercise data.

For each service, set Railway **Root Directory** to empty (monorepo root), then point to the config below:

| Service | Role                                           | Config file             |
| ------- | ---------------------------------------------- | ----------------------- |
| **API** | `client_secrets`, auth, PostgreSQL, YAML, CORS | `apps/api/railway.json` |
| **Web** | UI, microphone, client-side Realtime session   | `apps/web/railway.json` |

### Recommended order

1. Create and deploy the **API** service (its pre-deploy step applies the database migrations); copy its public HTTPS URL (e.g. `https://xxx.up.railway.app`).
2. Create the **Web** service with `NEXT_PUBLIC_EXAM_API_URL` set to that API URL.
3. On the **API**, set `CORS_ORIGINS` to the **Web** public URL (comma-separated if several). Without it, the browser blocks the requests.
4. Rebuild **Web** whenever the API URL changes: Next.js inlines the variable at **build** time.

### Variables per service

**API service** (`apps/api/.env.example`)

| Variable                                             | Required                     | Description                                                                                |
| ---------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                       | Yes                          | PostgreSQL connection string                                                               |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `WEB_URL` | Yes                          | Auth secret (32+ chars), public API URL, public web URL                                    |
| `ENCRYPTION_KEYS` / `ENCRYPTION_KEY_CURRENT`         | Yes                          | Master keys for users' provider API keys (`v1:<base64 32 bytes>`)                          |
| `SMTP_URL` / `MAIL_FROM`                             | Yes in prod                  | Verification and reset emails                                                              |
| `GITHUB_*` / `GOOGLE_*`                              | No                           | OAuth providers (`<id>`/`<secret>`)                                                        |
| `OPENAI_REALTIME_MODEL`                              | No                           | Realtime model when `service.yml` sets `llm.model: realtime` (default `gpt-realtime-mini`) |
| `CORS_ORIGINS`                                       | Strongly recommended in prod | Front-end origins, e.g. `https://your-web.up.railway.app`                                  |
| `PORT`                                               | No                           | Railway often injects `PORT`; default 3001 locally                                         |

**Web service** — build-time variables

| Variable                   | Required | Description                                                                                      |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_EXAM_API_URL` | Yes      | **Public HTTPS** API URL as seen by the **browser**                                              |
| `NEXT_PUBLIC_SITE_URL`     | No       | Public web URL for canonical links, Open Graph and the sitemap (default `http://localhost:3000`) |

---

## Local development

Requires Node 24 (`.nvmrc`), pnpm 10 and Docker (or Podman).

```bash
pnpm install
pnpm infra:up        # Postgres + Mailpit + S3 storage (docker-compose.dev.yml), then migrations and the audio bucket
pnpm setup:env       # writes apps/api/.env and apps/web/.env.local (secrets generated once, then kept)
pnpm samples:seed    # dev users; passwords: pnpm local:credentials
pnpm dev             # web http://localhost:3000, api http://localhost:3001
```

- **Email:** every local email (verification, reset, account deletion) lands in Mailpit at http://localhost:8025.
- **Audio recordings:** stored in a local RustFS (S3 API on http://localhost:9000, console on http://localhost:9001, login `parle` / `parle-dev-secret`). `pnpm setup:env` points the API's `S3_*` at it; enable recording per user in Paramètres.
- **Ports:** set `POSTGRES_PORT`, `MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT`, `STORAGE_PORT`, `STORAGE_CONSOLE_PORT` before `pnpm setup:env` and `pnpm infra:up`; they are saved in `apps/api/.env`.
- **Stop / wipe:** `pnpm infra:down` / `pnpm infra:reset`.

### Social sign-in (GitHub / Google) locally

There is no mock provider: register real development apps.

1. GitHub: _Settings → Developer settings → OAuth Apps → New_. Homepage `http://localhost:3000`, callback `http://localhost:3001/api/auth/callback/github`.
2. Google: _Google Cloud console → APIs & Services → Credentials → OAuth client ID (Web)_. Authorized redirect URI `http://localhost:3001/api/auth/callback/google`.
3. Put the ids and secrets in `apps/api/.env` (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), then re-run `pnpm setup:env`: it keeps them and turns the matching buttons on in the web app.

### Email in production

Set `RESEND_API_KEY` (HTTPS API, works on hosts that block outbound SMTP such as Railway) or `SMTP_URL`, plus `MAIL_FROM` with a verified sender domain. The API refuses to start in production without one of them.

## Package scripts

### API — `@parle-tcf/api` (`apps/api`)

| Script                                | Description                                                            |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `dev` / `build` / `start`             | NestJS                                                                 |
| `evals`                               | Corrector evals against `evals/dataset` (needs `OPENAI_API_KEY_EVALS`) |
| `rotate-keys`                         | Re-encrypt stored API keys with the current master key                 |
| `lint`, `typecheck`, `format`, `test` | Quality                                                                |

### Web — `@parle-tcf/web` (`apps/web`)

| Script                                | Description |
| ------------------------------------- | ----------- |
| `dev`, `build`, `start`               | Next.js     |
| `lint`, `typecheck`, `format`, `test` | Quality     |

### Shared — `@parle-tcf/shared` (`packages/shared`)

| Script                                | Description     |
| ------------------------------------- | --------------- |
| `build`                               | `tsc` → `dist/` |
| `lint`, `typecheck`, `format`, `test` | Quality         |

---

## Evaluation quality

`apps/api/evals` runs the corrector over a labelled dataset and reports exact/±1 agreement, per-criterion agreement, stability across passes, cost and latency (`evals/results.md`). The bundled dataset is **synthetic**; see `.github/workflows/evals.yml`.

## Architecture decisions

See [`docs/adr`](./docs/adr).

## Documentation

- Architecture and contributor rules: [CLAUDE.md](./CLAUDE.md)
- Exercises & YAML: [EXERCISES.md](./EXERCISES.md)
- Docker: [DOCKER.md](./DOCKER.md)
- CI: [`.github/README.md`](./.github/README.md)

### Language note

Repository **documentation** is in **English**. **Exam content** (agent instructions in YAML, the Tâche 1 question bank, and candidate-facing UI copy) stays in **French**.
