# Shared package (`@yorty-tcf/shared`)

Types and protocols shared between the **NestJS API** and the **Next.js web** app.

## Documentation

- [README.md](../../README.md) — local setup and Railway deployment.
- [AGENTS.md](../../AGENTS.md) — architecture and developer notes.
- [EXERCISES.md](../../EXERCISES.md) — exercises and YAML configuration.

## Contents (high level)

- `src/task-types.ts` — TCF/TEF task identifiers.
- `src/messages.ts` — legacy `DataMessage` types (historical LiveKit data channel).
- `src/metadata.ts` — legacy participant metadata types.
- Session / socket contracts — see `src/` for Zod schemas and `SOCKET_EVENTS`.

For integration details, prefer [AGENTS.md](../../AGENTS.md).
