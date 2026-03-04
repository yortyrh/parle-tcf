# Format Check

Check formatting, linting, and typecheck for the yorty-tcf-livekit monorepo without modifying files.

## Step 1 — Check formatting

```bash
cd yorty-tcf-livekit-agent && pnpm format:check
```

```bash
cd yorty-tcf-livekit-web && pnpm format:check
```

## Step 2 — Check linting

```bash
cd yorty-tcf-livekit-agent && pnpm lint
```

```bash
cd yorty-tcf-livekit-web && pnpm lint
```

## Step 3 — Check typecheck

```bash
cd yorty-tcf-livekit-agent && pnpm typecheck
```

## Step 4 — Report

Display a clear report per workspace:

```
=== yorty-tcf-livekit-agent ===
Formatting:  OK / FAIL (details)
Linting:     OK / FAIL (details)
Typecheck:   OK / FAIL (details)

=== yorty-tcf-livekit-web ===
Formatting:  OK / FAIL (details)
Linting:     OK / FAIL (details)

Final status: PASS / FAIL
```

## Rules

- This command is **NON-DESTRUCTIVE** — it never modifies files
- If issues are found, suggest using `/format-fix` to fix them
