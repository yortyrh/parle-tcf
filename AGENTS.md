# AGENTS.md

This repository contains a TCF oral examination platform built with LiveKit Agents and Next.js.

## Repository Layout

- `yorty-tcf-livekit-agent/`: LiveKit examiner agent in Node.js and TypeScript.
- `yorty-tcf-livekit-web/`: Next.js 15 App Router web application for candidates.
- `CLAUDE.md`: legacy project guidance. Keep `AGENTS.md` aligned with it when updating shared rules.

If you are working inside `yorty-tcf-livekit-agent/`, also read `yorty-tcf-livekit-agent/AGENTS.md` for LiveKit-specific guidance.

## Core Rules

- Use `pnpm` for installs, scripts, and tests in both packages.
- Keep the agent entrypoint at `yorty-tcf-livekit-agent/src/agent.ts`.
- Do not hardcode TCF prompts or exercises in TypeScript when they belong in config files.
- Edit agent behavior in `yorty-tcf-livekit-agent/config/agents/*.yml` when changing instructions, greetings, or durations.
- Keep JavaScript and TypeScript unit tests beside the tested file.
- When running unit tests, always append `-- --run`.
- Use a git commit title plus description body when creating commits.
- Never create git commits autonomously. Always let the user trigger commits explicitly using the `/commit` command.

## Architecture Summary

### Agent

- The agent reads participant metadata to determine `taskType` (`tache1`, `tache2`, `tache3`).
- Task-specific logic lives in `src/agents/TCFTache1.ts`, `src/agents/TCFTache2.ts`, and `src/agents/TCFTache3.ts`.
- The agent sends data messages to the web client for reports and exercise data.

### Web

- The web app uses Next.js App Router and React.
- The main session flow is welcome -> pre-connect -> session -> report.
- The route `app/api/connection-details/route.ts` generates LiveKit connection details and passes `taskType` in participant metadata.
- LiveKit UI code should stay in client components and keep the `'use client'` directive where required.

## Important Data And Config

- Agent configuration: `yorty-tcf-livekit-agent/config/agents/`
- Service configuration: `yorty-tcf-livekit-agent/config/service.yml`
- TCF exercises: `yorty-tcf-livekit-agent/config/tcf-exercises.csv`
- Agent reference content: `yorty-tcf-livekit-agent/config/info/`

## Development Commands

Run commands from the relevant package directory.

### Agent

- Install: `pnpm install`
- Download required model files: `pnpm run download-files`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Start: `pnpm start`
- Test: `pnpm test -- --run`
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`

### Web

- Install: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Start: `pnpm start`
- Lint: `pnpm lint`

## Environment

Required variables for both packages:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Required for the agent:

- `OPENAI_API_KEY`

Use `.env.local` for local package development when appropriate.

## Railway

Deploy as **two services** from this repository (same GitHub repo, isolated roots):

| Service | Root directory | Config as code |
| --- | --- | --- |
| Next.js (candidates) | `yorty-tcf-livekit-web` | `yorty-tcf-livekit-web/railway.json` |
| LiveKit agent (worker) | `yorty-tcf-livekit-agent` | `yorty-tcf-livekit-agent/railway.json` |

1. `railway login`, create a project, then add two services and attach the repo (or use the dashboard).
2. For each service, set **Root directory** as above. If the build uses **Railpack** and errors like `start.sh not found` / no start command, the root is almost certainly still the repo root: Railway then ignores the subfolder `Dockerfile` and falls back to Railpack. Fix the root directory first, then under **Build** set **Builder** to **Dockerfile** if needed.
3. If the dashboard does not pick up config automatically, set the **config file path** to the matching `railway.json` (path from repo root, e.g. `yorty-tcf-livekit-web/railway.json`).
4. Set variables on each service: web needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`; the agent also needs `OPENAI_API_KEY`. Use the same LiveKit project as locally.
5. Expose a **public domain** only on the web service. The agent is a background worker (Dockerfile `CMD`); avoid attaching an HTTP healthcheck if the platform allows.

Builds use the existing **Dockerfiles**; `watchPatterns` limit redeploys to the relevant subtree.

## Version Notes

- The project uses Node.js `v22.18.0` in `yorty-tcf-livekit-agent/.nvmrc`.
- The agent uses the LiveKit Agents Node.js SDK, so verify Node SDK feature support before copying patterns from Python examples.
