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

## Architecture Summary

### Agent

- The agent reads participant metadata to determine `taskType` (`tache1`, `tache2`, `tache3`).
- Task-specific logic lives in `src/agents/TCFTache1.ts`, `src/agents/TCFTache2.ts`, and `src/agents/TCFTache3.ts`.
- Shared timing logic lives in `src/agents/TimerController.ts`.
- The agent sends data messages to the web client for timer updates, reports, and exercise data.

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

## Version Notes

- The project uses Node.js `v24.14.0` in `yorty-tcf-livekit-agent/.nvmrc`.
- The agent uses the LiveKit Agents Node.js SDK, so verify Node SDK feature support before copying patterns from Python examples.
