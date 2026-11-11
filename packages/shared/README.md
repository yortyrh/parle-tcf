# Shared package (`@parle-tcf/shared`)

Types and Zod schemas shared between the **NestJS API** and the **Next.js web** app.

## Documentation

- [docs/](../../docs/README.md) — feature and architecture documentation.
- [README.md](../../README.md) — overview and quick start.
- [CLAUDE.md](../../CLAUDE.md) — architecture and developer notes.
- [EXERCISES.md](../../EXERCISES.md) — exercises and YAML configuration.

## Contents

- `src/task-types.ts` — TCF speaking task identifiers (`tache1` to `tache3`) and official durations.
- `src/schemas/` — Zod schemas of every oRPC procedure (sessions, settings, attempts, evaluation, audio, exercises).
- `src/models.ts` — default voice models; `src/pricing.ts` — token prices and cost estimates.
- `src/index.ts` — `API_ROUTES`, the HTTP path of every procedure.
