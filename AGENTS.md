# AGENTS.md

This repository is a **Turborepo + pnpm workspace monorepo** containing a TCF/TEF oral examination platform built with LiveKit Agents and Next.js.

## Repository Layout

```
/
├── turbo.json                    Turborepo pipeline configuration
├── pnpm-workspace.yaml           pnpm workspace definition
├── package.json                  Root workspace (scripts delegate to turbo)
├── apps/
│   ├── agent/                    LiveKit examiner agent (Node.js + TypeScript)
│   └── web/                      Next.js 15 App Router web application
├── packages/
│   └── shared/                   Shared types (TaskType, wire messages, metadata)
├── patches/                      pnpm patches (e.g. @livekit/agents)
├── docker-compose.yml
└── docker-compose.prod.yml
```

- `CLAUDE.md`: legacy project guidance. Keep `AGENTS.md` aligned with it when updating shared rules.

If you are working inside `apps/agent/`, also read `apps/agent/AGENTS.md` for LiveKit-specific guidance.

## Core Rules

- Use `pnpm` for installs, scripts, and tests. Run commands from the **repository root** via `turbo`, or from the relevant `apps/` directory.
- Keep the agent entrypoint at `apps/agent/src/agent.ts`.
- Do not hardcode TCF prompts or exercises in TypeScript when they belong in config files.
- Edit agent behavior in `apps/agent/config/agents/*.yml` when changing instructions, greetings, or durations.
- Shared types (TaskType, data message contracts, participant metadata) live in `packages/shared/`. Import from `@yorty-tcf/shared`.
- Keep JavaScript and TypeScript unit tests beside the tested file.
- When running unit tests, always append `-- --run`.
- Use a git commit title plus description body when creating commits.
- Never create git commits autonomously. Always let the user trigger commits explicitly using the `/commit` command.

## Architecture Summary

### Agent

- The agent reads participant metadata to determine `taskType` (`tache1`, `tache2`, `tache3`, `tef-section-a`, `tef-section-b`).
- Task-specific logic lives in `apps/agent/src/agents/TCFTache1.ts`, `TCFTache2.ts`, `TCFTache3.ts`, `TEFSectionA.ts`, `TEFSectionB.ts`.
- The agent sends data messages to the web client for reports and exercise data.
- A lightweight HTTP wake server (`apps/agent/src/wake-server.ts`) runs on `PORT` (default 8080) alongside the LiveKit worker, providing `/health` and `/wake` endpoints for scale-to-zero support.

### Web

- The web app uses Next.js App Router and React.
- The main session flow is welcome -> pre-connect -> session -> report.
- The route `apps/web/app/api/connection-details/route.ts` generates LiveKit connection details and passes `taskType` in participant metadata.
- LiveKit UI code should stay in client components and keep the `'use client'` directive where required.
- The root layout fires a non-blocking wake call to the agent (Layer B). The connection-details API route performs a blocking wake call as safety net (Layer A).

### Shared Package

- `packages/shared/` is an internal Turborepo package (consumed as TypeScript source, no build step).
- Contains `TaskType`, all wire protocol message types (`ExerciseDataMessage`, `ExerciseImageMessage`, `ReportMessage`, etc.), and `ParticipantMetadata`.

## Important Data And Config

- Agent configuration: `apps/agent/config/agents/`
- Service configuration: `apps/agent/config/service.yml`
- TCF exercises source of truth: `apps/agent/config/tcf-exercises.csv` (committed)
- TCF exercises runtime database: `apps/agent/config/tcf-exercises.db` (generated, not committed)
- Agent reference content: `apps/agent/config/info/`

The SQLite database is generated from the CSV at build time (`pnpm generate-db`) and is included in the
`pnpm build` step. Only one row is loaded into memory per session, which keeps agent memory usage low.
To update exercises, edit the CSV and run `pnpm generate-db` (or `pnpm build`) from `apps/agent/`.

## Development Commands

### Root (Turborepo)

- Install all deps: `pnpm install` (from repo root)
- Build all: `pnpm build`
- Dev all: `pnpm dev`
- Lint all: `pnpm lint`
- Typecheck all: `pnpm typecheck`
- Test all: `pnpm test`

### Agent (from `apps/agent/`)

- Generate SQLite DB from CSV: `pnpm generate-db`
- Download required model files: `pnpm run download-files`
- Dev: `pnpm dev`
- Build: `pnpm build` (runs `generate-db` automatically before compiling TypeScript)
- Start: `pnpm start`
- Test: `pnpm test -- --run`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`

### Web (from `apps/web/`)

- Dev: `pnpm dev`
- Build: `pnpm build`
- Start: `pnpm start`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`

## Environment

Required variables for both packages:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Required for the agent:

- `OPENAI_API_KEY`

Required for the web (production / Railway):

- `AGENT_WAKE_URL` -- internal URL of the agent service (e.g. `http://agent.railway.internal:8080`)

Use `.env.local` for local package development when appropriate.

## Railway

Deploy as **two services** from this repository (same GitHub repo, monorepo root):

| Service | Dockerfile | Config as code |
| --- | --- | --- |
| Next.js (candidates) | `apps/web/Dockerfile` | `apps/web/railway.json` |
| LiveKit agent (worker) | `apps/agent/Dockerfile` | `apps/agent/railway.json` |

Both Dockerfiles use `turbo prune` and expect the **repository root** as the Docker build context.

1. `railway login`, create a project, then add two services and attach the repo (or use the dashboard).
2. For each service, set the **config file path** to the matching `railway.json` (e.g. `apps/web/railway.json`). The `dockerfilePath` field in each `railway.json` already points to the correct Dockerfile relative to the repo root.
3. Set variables on each service: web needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `AGENT_WAKE_URL`; the agent also needs `OPENAI_API_KEY`.
4. Expose a **public domain** only on the web service. The agent exposes port 8080 for its wake/health endpoint but should use an internal domain (e.g. `agent.railway.internal`), not a public one.
5. The agent's `railway.json` includes `healthcheckPath: "/health"` for scale-to-zero support. Railway will scale the agent down when idle and wake it when the web sends an HTTP request.

`watchPatterns` in each `railway.json` include `packages/shared/**` so changes to shared types trigger rebuilds of both services.

## Version Notes

- The project uses Node.js `v22.18.0` in `apps/agent/.nvmrc`.
- The agent uses the LiveKit Agents Node.js SDK, so verify Node SDK feature support before copying patterns from Python examples.
