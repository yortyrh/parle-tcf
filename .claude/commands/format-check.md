# Format Check

Check formatting, linting, and typecheck for the parle-tcf monorepo without modifying files.

## Step 1 — Run the checks

From the repo root (Turborepo runs `@parle-tcf/api`, `@parle-tcf/web` and `@parle-tcf/shared`):

```bash
pnpm format:check
```

```bash
pnpm lint
```

```bash
pnpm typecheck
```

## Step 2 — Report

Display a clear report per package:

```
=== @parle-tcf/api ===
Formatting:  OK / FAIL (details)
Linting:     OK / FAIL (details)
Typecheck:   OK / FAIL (details)

=== @parle-tcf/web ===
...

=== @parle-tcf/shared ===
...

Final status: PASS / FAIL
```

## Rules

- This command is **NON-DESTRUCTIVE** — it never modifies files
- If issues are found, suggest using `/format-fix` to fix them
