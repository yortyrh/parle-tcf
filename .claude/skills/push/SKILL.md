---
name: push
description: Use when the user asks to push, publish or upload commits or a branch to the remote in this repo. Never push with plain git push.
---

# Push

Pushes go through `pnpm push [git push args...]`, never `git push`. The script (`scripts/push.mjs`) requires a clean tree, runs `pnpm verify` on HEAD, records the verified commit in `.git/parle-tcf-verified-commit`, then runs `git push`. The Lefthook pre-push hook (`scripts/check-push-stamp.mjs`) rejects any commit not recorded this way.

## Steps

1. Run `git status` and `git branch --show-current`. The tree must be clean; if not, tell the user and use the `commit` skill if they want the changes committed. Never stash or discard on your own.
2. To push another branch, check it out first.
3. Run with a long timeout (`timeout: 600000`) or in the background; verify takes minutes:

```bash
pnpm push                       # current branch, upstream set
pnpm push -u origin <branch>    # first push of a new branch
```

4. Report the real outcome: verify result, then push result. If HEAD was already verified, verify is skipped.

## Failures

- If verify fails, show the failing step and output, then fix the cause or report it. No blind retries.
- Never bypass: no `--no-verify`, no `LEFTHOOK=0`, no hand-written stamp, no plain `git push`.
- Never force-push unless the user explicitly asks, and never to `main`.

## Red flags, stop

- Typing `git push` instead of `pnpm push`.
- "Verify is slow, I'll skip it just this once."
- Stashing uncommitted changes without asking.
