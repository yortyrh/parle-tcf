# TCF/TEF — Oral exam practice platform

Monorepo (Turborepo + pnpm) for TCF/TEF oral exam simulations with an AI examiner: **OpenAI Realtime over direct WebRTC in the browser** (`@openai/agents`), a **NestJS API** for secrets and data (SQLite exercises, YAML), and **optional Socket.io** for multi-tab scenarios.

## Project layout

| Package | Role |
| --- | --- |
| **`apps/web`** | Next.js 15 — candidate UI, Realtime session, microphone, transcripts, report. |
| **`apps/api`** | NestJS — OpenAI `client_secrets`, config/exercise loading, Socket.io gateway. |
| **`packages/shared`** | Types, Zod schemas (session), socket events — `tsc` build → `dist/`. |

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
docker-compose up -d --build
```

- Web: **http://localhost** (host port 80 → container 3000).
- API: **http://localhost:3001** (health: `/health`).

The web image is built with `NEXT_PUBLIC_EXAM_API_URL` (see `docker-compose.yml` build args). The default targets `http://localhost:3001` so the browser on your machine can reach the API.

---

## Railway

### Target architecture

Use **two** Railway services from the **same** Git repo: **API** (NestJS) and **Web** (Next.js). You do **not** need a third “agent” service: after the LiveKit decoupling, voice and the OpenAI Realtime agent run **in the browser** via WebRTC; the API only serves secrets, exercise data, and Socket.io.

For each service, set Railway **Root Directory** to empty (monorepo root), then point to the config below (or the equivalent Dockerfile path):

| Service | Role | Config file |
| --- | --- | --- |
| **API** | `client_secrets`, SQLite, YAML, CORS, Socket.io | `apps/api/railway.json` |
| **Web** | UI, microphone, client-side Realtime session | `apps/web/railway.json` |

### Recommended order

1. Create and deploy the **API** service; copy its public HTTPS URL (e.g. `https://xxx.up.railway.app`).
2. Create the **Web** service with `NEXT_PUBLIC_EXAM_API_URL` set to that API URL (see below).
3. On the **API**, set `CORS_ORIGINS` to the **Web** public URL (one or more origins, comma-separated). Without this, the browser blocks `fetch` from the front end.
4. Rebuild **Web** if the API URL changes after the first build (the variable is fixed at **build** time for Next.js).

### Variables per service

**API service** (`apps/api/.env.example`)

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes | Calls to `POST /v1/realtime/client_secrets` |
| `CORS_ORIGINS` | Strongly recommended in prod | Front-end origins, e.g. `https://your-web.up.railway.app` (comma if several) |
| `PORT` | No | Railway often injects `PORT`; default 3001 locally |

**Web service** — variables at **Docker / Railway build** time

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_EXAM_API_URL` | Yes | **Public HTTPS** API URL as seen by the **browser** (not a Railway-internal-only URL for Internet clients) |

The web Dockerfile accepts `NEXT_PUBLIC_EXAM_API_URL` as a build `ARG`; on Railway, define it on the **Web** service so it is passed into the build.

---

## Local development (without Docker)

From the repo root after `pnpm install`:

| Command | Role |
| --- | --- |
| `pnpm dev` | Runs packages that expose `dev` (web + api via Turborepo). |
| `pnpm build` | Monorepo build (`^build` for `@yorty-tcf/shared` then apps). |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Quality (see each package’s scripts). |
| `pnpm format` / `pnpm format:check` | Prettier. |

Typical two terminals:

```bash
pnpm --filter @yorty-tcf/api run dev    # http://localhost:3001
pnpm --filter @yorty-tcf/web run dev    # http://localhost:3000
```

Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local` as needed.

Target a single package:

```bash
pnpm --filter @yorty-tcf/api <script>
pnpm --filter @yorty-tcf/web <script>
pnpm --filter @yorty-tcf/shared <script>
```

---

## Package scripts

### API — `@yorty-tcf/api` (`apps/api`)

| Script | Description |
| --- | --- |
| `dev` / `build` / `start` | NestJS |
| `generate-db` | TCF CSV → SQLite (`config/tcf-exercises.db`) |
| `rename-tef`, `generate-tef-instructions`, `sync-tef` | TEF content pipeline (`config/tef-exercices/` → `.md` instructions + images under `apps/web/public/`) |
| `lint`, `typecheck`, `format` | Quality |

Examples:

```bash
pnpm --filter @yorty-tcf/api run generate-db
pnpm --filter @yorty-tcf/api run sync-tef
```

### Web — `@yorty-tcf/web` (`apps/web`)

| Script | Description |
| --- | --- |
| `dev`, `build`, `start` | Next.js |
| `lint`, `typecheck`, `format` | Quality |

### Shared — `@yorty-tcf/shared`

| Script | Description |
| --- | --- |
| `build` | `tsc` → `dist/` |
| `typecheck` | `tsc --noEmit` |

---

## Documentation

- Architecture: [AGENTS.md](./AGENTS.md)
- Exercises & YAML: [EXERCISES.md](./EXERCISES.md)
- Docker: [DOCKER.md](./DOCKER.md)
- CI: [`.github/README.md`](./.github/README.md)

### Language note

Repository **documentation** is in **English** for contributors and sharing. **Exam content** (agent instructions in YAML, per-exercise `.md` under `apps/api/config/tef-exercices/`, and candidate-facing UI copy) stays in **French** where it supports TCF/TEF practice.
