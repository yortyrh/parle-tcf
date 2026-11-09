# parle-tcf — TCF speaking practice

Monorepo (Turborepo + pnpm) for practising the **speaking test (expression orale) of the TCF** with an AI examiner. Voice runs over **OpenAI Realtime via direct WebRTC in the browser** (`@openai/agents`). A **NestJS API** mints the ephemeral `client_secret` and serves the exercise bank (SQLite) and the YAML prompts.

> **Not official.** parle-tcf is an independent practice tool. It is not affiliated with, endorsed by, or connected to France Éducation international, and any level it shows is an estimate, not a TCF score.

## Project layout

| Package | Role |
| --- | --- |
| **`apps/web`** | Next.js 15 — candidate UI, Realtime session, microphone, transcripts, report. |
| **`apps/api`** | NestJS — OpenAI `client_secrets`, YAML prompts and exercise loading (oRPC contract). |
| **`packages/shared`** | Task types and Zod schemas for the session contract — `tsc` build → `dist/`. |

## Quick start (Docker Compose)

### Prerequisites

- Docker & Docker Compose
- **OpenAI** API key (`OPENAI_API_KEY`)

### Configuration

```bash
cp .env.example .env
# Set OPENAI_API_KEY
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

| Service | Role | Config file |
| --- | --- | --- |
| **API** | `client_secrets`, SQLite, YAML, CORS | `apps/api/railway.json` |
| **Web** | UI, microphone, client-side Realtime session | `apps/web/railway.json` |

### Recommended order

1. Create and deploy the **API** service; copy its public HTTPS URL (e.g. `https://xxx.up.railway.app`).
2. Create the **Web** service with `NEXT_PUBLIC_EXAM_API_URL` set to that API URL.
3. On the **API**, set `CORS_ORIGINS` to the **Web** public URL (comma-separated if several). Without it, the browser blocks the requests.
4. Rebuild **Web** whenever the API URL changes: Next.js inlines the variable at **build** time.

### Variables per service

**API service** (`apps/api/.env.example`)

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Calls to `POST /v1/realtime/client_secrets` |
| `OPENAI_REALTIME_MODEL` | No | Realtime model when `service.yml` sets `llm.model: realtime` (default `gpt-realtime-mini`) |
| `CORS_ORIGINS` | Strongly recommended in prod | Front-end origins, e.g. `https://your-web.up.railway.app` |
| `PORT` | No | Railway often injects `PORT`; default 3001 locally |

**Web service** — build-time variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_EXAM_API_URL` | Yes | **Public HTTPS** API URL as seen by the **browser** |

---

## Local development (without Docker)

Requires Node 24 (`.nvmrc`) and pnpm 10. From the repo root after `pnpm install`:

| Command | Role |
| --- | --- |
| `pnpm dev` | Runs web + api via Turborepo. |
| `pnpm build` | Monorepo build (`@parle-tcf/shared` first, then the apps). |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Quality checks in every package. |
| `pnpm format` / `pnpm format:check` | Prettier. |

Typical two terminals:

```bash
pnpm --filter @parle-tcf/api run dev    # http://localhost:3001
pnpm --filter @parle-tcf/web run dev    # http://localhost:3000
```

Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local` as needed.

---

## Package scripts

### API — `@parle-tcf/api` (`apps/api`)

| Script | Description |
| --- | --- |
| `dev` / `build` / `start` | NestJS |
| `generate-db` | TCF CSV → SQLite (`config/tcf-exercises.db`) |
| `lint`, `typecheck`, `format`, `test` | Quality |

### Web — `@parle-tcf/web` (`apps/web`)

| Script | Description |
| --- | --- |
| `dev`, `build`, `start` | Next.js |
| `lint`, `typecheck`, `format`, `test` | Quality |

### Shared — `@parle-tcf/shared` (`packages/shared`)

| Script | Description |
| --- | --- |
| `build` | `tsc` → `dist/` |
| `lint`, `typecheck`, `format`, `test` | Quality |

---

## Documentation

- Architecture: [AGENTS.md](./AGENTS.md)
- Exercises & YAML: [EXERCISES.md](./EXERCISES.md)
- Docker: [DOCKER.md](./DOCKER.md)
- CI: [`.github/README.md`](./.github/README.md)

### Language note

Repository **documentation** is in **English**. **Exam content** (agent instructions in YAML, the Tâche 1 question bank, and candidate-facing UI copy) stays in **French**.
