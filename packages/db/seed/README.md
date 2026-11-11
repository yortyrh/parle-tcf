# Sample exercise bank

`sample-exercises.csv` holds a few **original** Tâche 2 and Tâche 3 subjects, written for this repository in the style of the TCF speaking test. They are MIT-licensed like the rest of the code and exist so that tests, CI and anyone cloning the repository have a working bank.

- `sample-exercise-bank.sql` is generated from the CSV: `pnpm exercises:seed-sql packages/db/seed/sample-exercises.csv --out packages/db/seed/sample-exercise-bank.sql`.
- `pnpm infra:up` loads it into an empty local bank when `EXERCISE_DATA_TOKEN` is not set; `pnpm exercises:load --file packages/db/seed/sample-exercise-bank.sql` loads it by hand.

The production bank (subjects published monthly by third parties) is not part of this repository: it lives in a private repository and is loaded at deploy time. Anyone can build their own bank with `pnpm exercises:import`. See [docs/features/exercise-bank.md](../../../docs/features/exercise-bank.md).
