# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Earlier history of the web app (in French) lives in [`apps/web/CHANGELOG.md`](./apps/web/CHANGELOG.md).

## [Unreleased]

### Added
- Accounts (Better Auth: email/password, optional GitHub/Google) with email verification and password reset.
- Per-user OpenAI API key, encrypted with AES-256-GCM (versioned master keys, `rotate-keys` script); settings page with connection test.
- PostgreSQL persistence (`@parle-tcf/db`, Drizzle): exercise bank seed, exam runs, attempts and transcripts, scoped by user.
- Official task timers (countdown), tâche 2 preparation, and a full-exam mode chaining the three tasks.
- Transcript autosave (checkpoints) and save on task completion.
- CEFR evaluation after each task (rubric v1, five criteria, corrected transcript with typed errors) via the Vercel AI SDK with the user's key; retries, failure state and `attempts.reevaluate`.
- Overall level of a full exam (weighted median of the three tasks).
- Result, history (filters, delete), progression and comparison pages.
- Cost estimate per attempt, daily-minutes and monthly-cost limits (`LIMIT_REACHED`).

### Changed
- The examiner no longer writes a report (`envoiRapport`) nor coaches after the task; `finSession` closes the task and the separate corrector evaluates it.
- The exercise bank moved from SQLite to PostgreSQL; `generate-db` is replaced by `db:seed`.
- Sessions are minted with the signed-in user's key; `OPENAI_API_KEY` is no longer read by the API.


### Changed

- Renamed the project to **parle-tcf** and the workspace scope to `@parle-tcf/*`.
- Zod 4 everywhere (`apps/api` and `packages/shared` moved from Zod 3).
- Node 24 in Docker images, CI and `engines`, matching `.nvmrc`.
- pnpm settings (built dependencies, patches) consolidated in `pnpm-workspace.yaml`; both `@openai/agents-*` patches are declared.
- `/` now redirects to `/tcf`.
- `apps/api` tests run once (`vitest run`) instead of watch mode.
- `packages/shared` gained `lint`, `format` and `test` scripts.

### Removed

- **TEF**: web route `/tef`, `tef-app-config.ts`, the exercise image viewer, `config/tef-exercices` and its copy in `public/`, the TEF YAML agents, the TEF generation scripts, TEF branches in the API services, and TEF-only reference files under `config/info/`.
- **Socket.io**: the API gateway, the client in the Realtime provider, `SOCKET_EVENTS` and the related dependencies. The gateway only joined rooms; no event was ever handled.
- **LiveKit leftovers**: legacy `messages.ts` / `metadata.ts` types, the legacy blocks of `service.yml`, and mentions in the docs and `.claude/commands`.
- Stale `out/` (`turbo prune` output of the old LiveKit agent) and the `noop-test.mjs` placeholder.
