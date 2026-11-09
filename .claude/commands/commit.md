# Smart Commit

Create an intelligent git commit for the parle-tcf monorepo (api + web + shared).

### Step 1 — Format & Lint (REQUIRED)

From the repo root:

```bash
pnpm format && pnpm lint
```

- If errors persist after automatic fixes, list them and ask the user
- After fixes, re-stage all modified files with `git add .`

## Step 2 — Typecheck (REQUIRED)

```bash
pnpm typecheck
```

- If type errors are found, fix them before continuing

## Step 3 — Tests (REQUIRED)

```bash
pnpm test
```

- If tests fail, fix them and re-run
- After fixes, re-stage with `git add .`

# Step 4 — Analyze changes (in parallel)

- `git status` to see modified files
- `git diff --staged` or `git diff` to see detailed changes
- `git log --oneline -10` to see recent commit style

## Step 5 — Stage and commit

If no files are staged, run `git add .`

Analyze changes to generate the commit message:
- Type of changes (feat, fix, refactor, style, docs, test, deps, chore, etc.)
- Modified files and their nature
- If YAML files (`config/agents/*.yml`) or CSV (`config/tcf-exercises.csv`) were modified, mention it explicitly in the message
- Follow the existing project commit style (descriptive phrases)

### Message format

```
<Type>: <Short and descriptive title>

<Detailed description if necessary>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

### Create the commit

```bash
git commit -m "$(cat <<'EOF'
<generated message>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

## Step 6 — Verify

- `git status` to confirm
- `git log --oneline -1` to show the commit
- Present statistics (modified files, insertions, deletions)

## Rules

- **ALWAYS** run format/lint/typecheck/tests BEFORE committing
- Messages in English
- **ALWAYS** include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- NEVER commit with linting errors or failing tests (unless explicitly authorized)
