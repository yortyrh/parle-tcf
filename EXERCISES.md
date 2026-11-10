# Exercises & configuration guide

How exam content is managed: YAML examiner prompts, the Tâche 1 question bank, and the TCF exercise bank.

**Language:** This file is documentation for maintainers (English). The examiner YAML (`baseInstructions`, `instructions`, `greeting`) and the question bank stay in **French**, because the model speaks them to the candidate.

## Examiner configuration (YAML)

Files live in **`apps/api/config/agents/`** and are loaded by the API when creating a session.

### YAML shape

- `name` / `description` — task metadata.
- `settings` — e.g. `allowInterruptions`.
- `baseInstructions` — shared system instructions.
- `instructions` — task-specific instructions.
- `greeting` — opening line for the oral interaction.

### Supported tasks

| File         | Task                                   |
| ------------ | -------------------------------------- |
| `tache1.yml` | Tâche 1 — entretien dirigé             |
| `tache2.yml` | Tâche 2 — exercice en interaction      |
| `tache3.yml` | Tâche 3 — expression d'un point de vue |

### What the API appends to the prompt

- **Tâche 1**: `apps/api/config/info/questions-tache1-entretien.md`, under the label « BANQUE DE QUESTIONS DE RÉFÉRENCE ». The examiner draws from it and never reads it aloud.
- **Tâches 2 and 3**: the exercise text from the database, under the label « EXERCICE À UTILISER ».

### Global voice & model

`ExamSessionService` reads **`apps/api/config/service.yml`**:

- `llm.voice` — passed to OpenAI Realtime (`client_secrets` and returned in `agentConfig`).
- `llm.model` — if set to `realtime`, the API resolves the concrete model via `OPENAI_REALTIME_MODEL` or a built-in default (`ExamSessionService.resolveRealtimeModel`). Any other non-empty string is sent as-is to OpenAI.

See [apps/api/config/SERVICE_CONFIG.md](./apps/api/config/SERVICE_CONFIG.md) for details.

---

## Exercise database (Tâches 2 and 3)

- Store: PostgreSQL. `exercises` holds one row per distinct subject (deduplicated on task + `content_hash`, see `packages/db/src/exercise-bank.ts`); `exercise_occurrences` records every month, part and position where a subject was published; `exercise_sessions` is one row per month; `exercise_aliases` keeps old ids of merged subjects working; `import_runs` logs each import.
- Initial data: migration `packages/db/migrations/0003_exercise_bank_data.sql`, generated from the original CSV (in git history) with `pnpm exercises:seed-sql <csv>`. It is applied by `pnpm db:migrate` like any migration.
- New months: `pnpm exercises:import` (default: the two newest months; `--month YYYY-MM`, `--all`, `--dry-run`). It sends one plain request per page with a pause in between and **stops when the site refuses the request** (the run is recorded as `blocked`; it is never retried or worked around). A page saved from a browser can be imported with `pnpm exercises:import --file page.html --month YYYY-MM`.
- In production the importer runs as a Railway cron service (`packages/importer/railway.json`, Mondays 06:00 UTC).
- Candidates browse subjects at `/sujets` (by task, month and keywords).

---

## Reference material

`apps/api/config/français/` holds reference documents that the code does not load yet (CEFR self-assessment grid, logical connectors). They are the starting point for the evaluation rubric.

---

## Prompt tips

- **Language**: keep candidate-facing and in-character content in **French**; technical notes in YAML can be English if you prefer.
- **Constraints**: durations, number of questions, etc. belong in `instructions`.
- **Tone**: adjust in `instructions` / `greeting`.
