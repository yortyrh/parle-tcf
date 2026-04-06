# Exercises & configuration guide

How exam content is managed: YAML agent prompts, TCF/TEF exercises, and images.

**Language:** This file is documentation for maintainers (English). **Per-task agent YAML** (`baseInstructions`, `instructions`, `greeting`) and **TEF `.md` files** under `apps/api/config/tef-exercices/` should stay in **French** — they are exam / Realtime prompts. For TEF, the `.md` files embed the same instruction text as the section YAML (plus the per-exercise block) as the **complete** system prompt sent to the model.

## Examiner configuration (YAML)

Files live in **`apps/api/config/agents/`** and are loaded by the API when creating a session.

### YAML shape

- `name` / `description` — task metadata.
- `settings` — e.g. `allowInterruptions`.
- `baseInstructions` — shared system instructions.
- `instructions` — task-specific instructions.
- `greeting` — opening line for the oral interaction.

### Supported tasks

- `tache1.yml`, `tache2.yml`, `tache3.yml` (TCF)
- `tef-section-a.yml`, `tef-section-b.yml` (TEF)

### Global voice & model

`ExamSessionService` reads **`apps/api/config/service.yml`**:

- `llm.voice` — passed to OpenAI Realtime (`client_secrets` and returned in `agentConfig`).
- `llm.model` — if set to `realtime`, the API resolves the concrete model via `OPENAI_REALTIME_MODEL` or a built-in default (`ExamSessionService.resolveRealtimeModel`). Any other non-empty string is sent as-is to OpenAI.

See [apps/api/config/SERVICE_CONFIG.md](./apps/api/config/SERVICE_CONFIG.md) for details.

---

## Exercise database

### TCF (tasks 2 and 3)

- CSV source: **`apps/api/config/tcf-exercises.csv`**
- Runtime SQLite: **`apps/api/config/tcf-exercises.db`**

After changing the CSV:

```bash
pnpm --filter @yorty-tcf/api run generate-db
```

### TEF (sections A and B)

- **Source**: `apps/api/config/tef-exercices/TEF-A/` and `TEF-B/` — for each item, pair `TEF-A-01.png` + `TEF-A-01.md`.
- **Self-contained prompts**: Each `.md` is the **full** Realtime **system** prompt for that exercise: content from `apps/api/config/agents/tef-section-a.yml` or `tef-section-b.yml`, then the heading `EXERCICE À UTILISER:`, then the exercise-specific body (role, annonce, infos, consigne). The API sends that file verbatim as `agentConfig.instructions` (YAML is still used at runtime for `greeting`, `settings`, `name`, `description` only).
- **Images served to the browser**: copied to `apps/web/public/tef-exercices/` via `sync-tef`.
- **Test / edit one exercise**: Open a `.md`, paste into OpenAI Realtime Playground as the system message, or edit the file directly; no need to reassemble YAML + fragment mentally.
- **After changing generic rules** in `tef-section-a.yml` / `tef-section-b.yml`, propagate to all exercises:

  ```bash
  pnpm --filter @yorty-tcf/api run generate-tef-instructions -- --upgrade
  ```

  This re-merges the YAML template with the existing exercise body (no vision / no API cost for the exercise text).

---

## Generation scripts (`apps/api`)

Run from the monorepo root with `@yorty-tcf/api`:

| Script | Role |
| --- | --- |
| `generate-db` | TCF CSV → SQLite |
| `rename-tef` | Rename scan PNGs to `TEF-{A\|B}-NN.png` (dry-run; `--apply` to write) |
| `generate-tef-instructions` | Vision → exercise body; merges with YAML into **self-contained** `.md` per PNG. `--stub` placeholders without `OPENAI_API_KEY`. `--upgrade` re-merge YAML + existing body (e.g. after editing agent YAML). `--force` overwrites existing `.md` and re-runs vision. |
| `sync-tef` | Copy PNGs to `apps/web/public/tef-exercices/` |

Example:

```bash
pnpm --filter @yorty-tcf/api run generate-tef-instructions -- --upgrade
pnpm --filter @yorty-tcf/api run generate-tef-instructions -- --force
pnpm --filter @yorty-tcf/api run sync-tef
```

---

## Prompt tips

- **Language**: keep candidate-facing and in-character content in **French** for TCF/TEF; technical notes in YAML can be English if you prefer.
- **Constraints**: durations, number of questions, etc. belong in `instructions`.
- **Tone**: adjust in `instructions` / `greeting`.
