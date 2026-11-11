# Exercise bank

## Summary

The Tâche 2 and Tâche 3 subjects published each month, stored in PostgreSQL with one row per distinct subject, plus an importer for new months and a topic browser. Tâche 1 has no subjects: the examiner draws from a fixed question bank. Maintainer details: [`EXERCISES.md`](../../EXERCISES.md).

## User flow

**Sujets** (`/sujets`): browse subjects by task, month (« Tous les mois » or one month) and keywords (accent-insensitive), 20 per page, with a marker for subjects that rely on a document. Opening a subject starts a practice session on it. The landing page shows a few subjects of the latest month.

## How it works

- **Deduplication:** `content_hash` (`packages/db/src/exercise-bank.ts`) normalises the text so a subject republished with different whitespace stays one row; each publication is an `exercise_occurrences` row (month, part, position).
- **Merged subjects:** `exercise_aliases` keeps old ids working in links and history.
- **Where the subjects live:** the real bank (about 1,650 subjects published by a third-party site) is **not** in this repository: it lives in the private repository `yortyrh/parle-tcf-data` ([ADR 0006](../adr/0006-private-exercise-bank.md)). This repository ships an original **sample bank** (`packages/db/seed`, 24 Tâche 2 and 8 Tâche 3 subjects) for tests, CI and contributors.
- **Loading:** `loadExerciseBank` (`packages/db/src/exercise-bank-loader.ts`) fills an **empty** bank in one transaction. Production runs it in the API pre-deploy step after the migrations (`node packages/db/dist/load-exercise-bank.js`, downloading with `EXERCISE_DATA_TOKEN`); `pnpm infra:up` and `docker compose` load the private bank with a token and the sample bank without one; `pnpm exercises:load [--file <sql>] [--force]` does it by hand.
- **Generating bank SQL:** `pnpm exercises:seed-sql <csv> --out <file.sql>` (idempotent upserts).
- **Importer** (`packages/importer`): `pnpm exercises:import` (default: the two newest months; `--month YYYY-MM`, `--all`, `--file page.html --month YYYY-MM`, `--dry-run`). It makes plain HTTP requests, one page at a time with a pause, and **stops when the site refuses a request** (the run is logged as `blocked`). It never uses browser automation or works around bot protection.
- **Production:** the importer runs as a Railway cron service (Mondays 06:00 UTC, `packages/importer/railway.json`).
- **Session selection:** a requested exercise id must belong to the task, otherwise it is ignored; without an id a random subject is picked. Previous/next navigation follows a stable order.

## API

`/exercises/list`, `/exercises/sessions`, `/exercises/featured` (public).

## Data

`exercises`, `exercise_occurrences`, `exercise_sessions`, `exercise_aliases`, `import_runs`.

## Configuration

`EXERCISE_DATA_TOKEN` (fine-grained GitHub token, read-only Contents on the data repository), optional `EXERCISE_DATA_REPO`, `EXERCISE_DATA_PATH`, `EXERCISE_DATA_REF`.

## Code map

`apps/api/src/exercise/`, `packages/db/src/exercise-bank.ts`, `packages/db/src/exercise-bank-loader.ts`, `packages/db/src/load-exercise-bank.ts`, `packages/db/seed/`, `packages/importer/src/{fetch,parse,import,run,cli}.ts`, `apps/web/app/(app)/sujets/`.

## Tests

`exercise.service.spec.ts`, `packages/db/src/exercise-bank*.test.ts`, `packages/importer/src/*.test.ts`, `apps/api/test/integration/{exercises,importer}.spec.ts`, `apps/e2e/tests/topics.spec.ts`.
