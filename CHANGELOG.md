# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Earlier history of the web app (in French) lives in [`apps/web/CHANGELOG.md`](./apps/web/CHANGELOG.md).

## [Unreleased]

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
