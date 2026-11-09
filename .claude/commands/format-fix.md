# Format Fix

Automatically fix formatting and linting for the parle-tcf monorepo (api + web + shared).

## Step 1 — Fix

From the repo root (Turborepo runs every package):

```bash
pnpm format && pnpm lint
```

> **Note**: there is no `lint:fix` script. Lint errors that Prettier cannot fix are listed for manual intervention.

## Step 2 — Summary

- List files modified by formatting/linting
- Display remaining errors that require manual intervention
- Indicate whether the code is ready to be committed

## Step 3 — Re-stage files

If files were already staged or modified:

```bash
git add .
```

## Rules

- This command **MODIFIES** files — that is its purpose
- Use before each commit and before creating a Pull Request
- If errors persist, list them clearly and ask the user how to proceed
