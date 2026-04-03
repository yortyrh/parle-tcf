# Docker & Railway

Docker Compose for local development and Railway for production.

## Prerequisites

- Docker 20.10+, Docker Compose v2+
- **OpenAI** API key (`OPENAI_API_KEY`)

## Local — Docker Compose

### 1. Environment

```bash
cp .env.example .env
# Set OPENAI_API_KEY
```

### 2. Start

```bash
docker-compose up -d --build
```

- **API**: `http://localhost:3001` — health: `GET /health`
- **Web**: `http://localhost` (map 80 → 3000)

`docker-compose.yml` passes build arg `NEXT_PUBLIC_EXAM_API_URL=http://localhost:3001` so the Next.js bundle calls the API from the host browser.

### 3. Logs & lifecycle

| Task | Command |
| --- | --- |
| Follow logs | `docker-compose logs -f` |
| API logs only | `docker-compose logs -f api` |
| Stop | `docker-compose stop` |
| Remove containers | `docker-compose down` |
| Rebuild | `docker-compose up -d --build` |

---

## Railway

**Two services** from the repo root (**empty root directory**). There is no separate **agent** service: the Realtime agent runs in the **browser**; the **API** holds secrets and data.

| Service | `railway.json` | Image |
| --- | --- | --- |
| **API** | `apps/api/railway.json` | Nest + `better-sqlite3` |
| **Web** | `apps/web/railway.json` | Next.js standalone |

### Typical sequence

1. Deploy **API**; note the public URL.
2. Configure **Web** with `NEXT_PUBLIC_EXAM_API_URL` pointing at that URL (build-time).
3. Update **API** `CORS_ORIGINS` to the **Web** URL; redeploy the API if needed.

### Variables

**API**

- `OPENAI_API_KEY` — required
- `CORS_ORIGINS` — allowed browser origins (e.g. `https://your-web.up.railway.app`)
- `PORT` — optional (Railway often provides `PORT`)

**Web** (injected at **build** time)

- `NEXT_PUBLIC_EXAM_API_URL` — HTTPS URL the **browser** uses to reach the API

---

## Images

- `apps/api/Dockerfile` — `turbo prune @yorty-tcf/api`, Nest build, `CMD node apps/api/dist/main.js`
- `apps/web/Dockerfile` — `turbo prune @yorty-tcf/web`, Next standalone build, `ARG NEXT_PUBLIC_EXAM_API_URL`

Functional overview: [AGENTS.md](./AGENTS.md).
