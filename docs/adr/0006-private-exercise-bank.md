# 6. The real exercise bank lives in a private repository

Status: accepted

## Context

The exercise bank holds about 1,650 Tâche 2 and Tâche 3 subjects collected from monthly lists published by a third-party site. They shipped inside migration `0003_exercise_bank_data.sql`, and the original CSV was in early commits. The application repository is about to become public under the MIT licence, and those texts are not ours to relicense.

## Decision

- The real bank (`exercise-bank.sql` and the original `tcf-exercises.csv`) moves to the private repository `yortyrh/parle-tcf-data`.
- Migration `0003` keeps only its structural part (the fixed Tâche 1 row and the content-hash backfill). Editing an applied migration is safe here: Drizzle only runs migrations newer than the last applied one and does not re-check hashes, so databases that already have the data are unaffected.
- `@parle-tcf/db` gains a loader (`exercise-bank-loader.ts`, CLI `load-exercise-bank.js`, root `pnpm exercises:load`) that fills an **empty** bank in one transaction, from a local file or from the private repository through the GitHub contents API with `EXERCISE_DATA_TOKEN`.
- Production loads it in the API pre-deploy step, right after the migrations, so the token is a runtime variable and never ends up in an image layer. With a non-empty bank the step does nothing; without a token it only logs a hint.
- The public repository ships an original sample bank (`packages/db/seed`, MIT) used by tests, CI, `pnpm infra:up` without a token and `docker compose`. Anyone can build a real bank with `pnpm exercises:import`.
- The Git history is rewritten so that no commit contains the third-party texts.

## Consequences

- Tests no longer depend on 1,650 real rows: they load the sample bank or their own fixtures.
- A fresh production environment needs `EXERCISE_DATA_TOKEN` (fine-grained, read-only Contents on the data repository) or an importer run.
- Regenerating the real bank happens against the private repository: `pnpm exercises:seed-sql <csv> --out <file>`.
- The monthly importer keeps writing to the production database; the private repository is the initial bank, not a mirror.
