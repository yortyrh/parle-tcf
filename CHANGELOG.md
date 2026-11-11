# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Earlier history of the web app lives in [`apps/web/CHANGELOG.md`](./apps/web/CHANGELOG.md).

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
- Experimental Gemini Live backend (ephemeral tokens, WebSocket transport) selectable in settings; evaluation with Gemini keys.
- Optional audio recording of each attempt (explicit consent, S3-compatible storage with signed URLs, playback on the result page, deleted with the attempt, on consent withdrawal and with the account).
- Corrector evals (`pnpm --filter @parle-tcf/api evals`), a synthetic labelled dataset, an evals workflow, and ADRs in `docs/adr`.
- Structured logging (pino) with secret redaction, privacy page, and a cost estimate before a full exam.
- Cost estimate per attempt, daily-minutes and monthly-cost limits (`LIMIT_REACHED`).

### Changed
- The examiner no longer writes a report (`envoiRapport`) nor coaches after the task; `finSession` closes the task and the separate corrector evaluates it.
- The exercise bank moved from SQLite to PostgreSQL; `generate-db` is replaced by `db:seed`.
- Sessions are minted with the signed-in user's key; `OPENAI_API_KEY` is no longer read by the API.
- Toolchain: pnpm 12 (`allowBuilds` replaces `onlyBuiltDependencies`) and Node.js 26 LTS, installed by pnpm from `devEngines.runtime`; Docker images, CI and `.nvmrc` follow. Turborepo 2.11.
- Default voice models: `gpt-realtime-2.1-mini` (OpenAI retires `gpt-realtime-mini` on 2027-01-20) and `gemini-3.8-live`; default OpenAI voice `marin`.
- Sessions suit learners who pause: low semantic VAD eagerness and a French transcription hint (OpenAI), low end-of-speech sensitivity (Gemini).
- Examiner prompts restructured after the OpenAI and Gemini prompting guides (labelled sections, French pinned, unclear-audio and tool rules, no contradictions).
- Dependencies updated within their ranges, plus Next.js 15.5.29 and nodemailer 10, fixing the known advisories that had a patch.
- Documentation: one page per feature in `docs/`, `llms.txt`, rewritten README; every document is in English (PRD translated to `docs/prd.md`).
- Docker builds no longer send nested `node_modules`/build output to the context; the Turborepo cache no longer stores `.next/cache`.
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
