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

| File | Task |
| --- | --- |
| `tache1.yml` | Tâche 1 — entretien dirigé |
| `tache2.yml` | Tâche 2 — exercice en interaction |
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

- CSV source: **`apps/api/config/tcf-exercises.csv`** (columns `id,taskType,content,url,imageUrl,imagePath,isImageBased`)
- Runtime store: PostgreSQL table **`exercises`**

After changing the CSV:

```bash
pnpm --filter @parle-tcf/db db:seed
```

---

## Reference material

`apps/api/config/français/` holds reference documents that the code does not load yet (CEFR self-assessment grid, logical connectors). They are the starting point for the evaluation rubric.

---

## Prompt tips

- **Language**: keep candidate-facing and in-character content in **French**; technical notes in YAML can be English if you prefer.
- **Constraints**: durations, number of questions, etc. belong in `instructions`.
- **Tone**: adjust in `instructions` / `greeting`.
