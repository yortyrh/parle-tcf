# Exercises & configuration guide

How exam content is managed: YAML agent prompts, TCF/TEF exercises, and images.

**Language:** This file is documentation for maintainers (English). **Per-task agent YAML** (`baseInstructions`, `instructions`, `greeting`) for **TCF** tasks and **TEF `*.instructions.md`** under `apps/api/config/tef-exercices/` should stay in **French** where they contain candidate/character-facing content. For TEF, each `TEF-*-NN.instructions.md` is the **full** Realtime **system** prompt: optional shared prefix from **`INSTRUCTIONS_PREFIX.md`** (per section), then model-generated exercise body. **`*.conseils.md`** are candidate-facing only and are not sent to the model.

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

- **Source**: `apps/api/config/tef-exercices/TEF-A/` and `TEF-B/` — for each item: `TEF-A-01.png`, `TEF-A-01.instructions.md`, and `TEF-A-01.conseils.md` (same pattern for `TEF-B`). Without `*.conseils.md`, the “Conseils” tab has no markdown for that exercise.
- **Self-contained agent prompts**: Each `*.instructions.md` on disk is the full Realtime **system** prompt: `generate-tef-instructions` prepends the block for that section from **`apps/api/config/tef-exercices/INSTRUCTIONS_PREFIX.md`** (`## Section A` / `## Section B`), then the vision-generated body. The API sends the file as `agentConfig.instructions`. TEF task YAML (`tef-section-*.yml`) supplies **metadata only** (`name`, `description`, `settings`, `greeting`) — not the long system prompt.
- **Conseils**: `*.conseils.md` powers the candidate “Conseils” tab only (`practiceGuideMarkdown`); it is never sent to the model.
- **Images served to the browser**: copied to `apps/web/public/tef-exercices/` via `sync-tef`.
- **Test / edit one exercise**: Edit `INSTRUCTIONS_PREFIX.md` or an `*.instructions.md`, then re-run generation with `--force` on affected PNGs if you use the scripts.
- **Changing the shared instruction prefix**: Edit `INSTRUCTIONS_PREFIX.md`, then regenerate instructions for all exercises that should pick up the change:

  ```bash
  pnpm --filter @yorty-tcf/api run generate-tef-instructions -- --force
  ```

---

## Generation scripts (`apps/api`)

Run from the monorepo root with `@yorty-tcf/api`:

| Script | Role |
| --- | --- |
| `generate-db` | TCF CSV → SQLite |
| `rename-tef` | Rename scan PNGs to `TEF-{A\|B}-NN.png` (dry-run; `--apply` to write) |
| `generate-tef-instructions` | Vision → body in **`TEF-*-NN.instructions.md`**, with optional prefix from **`INSTRUCTIONS_PREFIX.md`**. `--stub` without `OPENAI_API_KEY`. `--force` overwrites and re-runs vision. |
| `generate-tef-conseils` | Vision → **`TEF-*-NN.conseils.md`** (candidate guide). `--stub` / `--force` as above. |
| `sync-tef` | Copy PNGs to `apps/web/public/tef-exercices/` |

Example:

```bash
pnpm --filter @yorty-tcf/api run generate-tef-instructions -- --force
pnpm --filter @yorty-tcf/api run generate-tef-conseils -- --force
pnpm --filter @yorty-tcf/api run sync-tef
```

---

## Prompt tips

- **Language**: keep candidate-facing and in-character content in **French** for TCF/TEF; technical notes in YAML can be English if you prefer.
- **Constraints**: durations, number of questions, etc. belong in `instructions`.
- **Tone**: adjust in `instructions` / `greeting`.
