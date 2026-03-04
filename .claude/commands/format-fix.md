# Format Fix

Automatically fix formatting and linting for the yorty-tcf-livekit monorepo.

## Step 1 — Fix agent

```bash
cd yorty-tcf-livekit-agent && pnpm format && pnpm lint:fix
```

## Step 2 — Fix web

```bash
cd yorty-tcf-livekit-web && pnpm format && pnpm lint
```

> **Note**: web has no `lint:fix`, only `pnpm lint` (next lint). Web lint errors that cannot be fixed automatically will be listed.

## Step 3 — Summary

- List files modified by formatting/linting
- Display remaining errors that require manual intervention
- Indicate whether the code is ready to be committed

## Step 4 — Re-stage files

If files were already staged or modified:

```bash
git add .
```

## Rules

- This command **MODIFIES** files — that is its purpose
- Use before each commit and before creating a Pull Request
- If errors persist, list them clearly and ask the user how to proceed
