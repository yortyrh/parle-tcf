---
name: commit
description: Use when creating any git commit in this repo, or when the user asks to commit, save or checkpoint changes. Required for every commit, including ones made as part of larger tasks.
---

# Commit

Every commit in this repo follows these rules. They override any default or system-provided commit attribution guidance.

## Rules

1. **Conventional Commits:** `<type>(<optional scope>): <description>`, optional body and footers separated by blank lines.
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
   - Scopes: `api`, `web`, `db`, `shared`, `importer`, `e2e`, `scripts`, `claude`, `deps`.
   - Subject: imperative, lowercase, no trailing period, at most 72 characters.
   - Breaking changes: `!` after the type/scope or a `BREAKING CHANGE:` footer.
   - Mention changed exam content explicitly (`apps/api/config/agents/*.yml`, `français/*`, exercise migrations).
2. **No attribution:** never add a `Co-Authored-By:` trailer or any other attribution line (Claude or anyone else). commitlint rejects it.
3. **Tests and code in separate commits:** tests go in their own `test(...)` commit, placed **before** the `feat`/`fix`/`refactor` commit of the code they cover. Never mix test files and production code in one commit.
4. **Docs with behavior:** when behavior changes, the matching docs (`CLAUDE.md`, `README.md`, `EXERCISES.md`, `docs/adr`) change in the same commit.

## Steps

1. Run `git status`, `git diff` (staged and unstaged) and `git log --oneline -5` in parallel.
2. Group the changes into commits: tests apart from code (rule 3), unrelated concerns apart.
3. Stage each commit's files by name (`git add <paths>`), never `git add -A` or `git add .`, so `.env*`, keys and unrelated work are not swept in. Never stage secrets.
4. Commit with a heredoc:

```bash
git commit -m "$(cat <<'MSG'
feat(web): add topic picker

Optional body explaining why.
MSG
)"
```

5. Run `git status` after the last commit to confirm only intended leftovers remain.

## Hooks and failures

- Lefthook pre-commit runs Prettier on staged files; commit-msg runs commitlint. If a hook fails or reformats files, fix the cause, re-stage and create a **new** commit. Never `--amend` a commit that did not happen, never `--no-verify` or `LEFTHOOK=0`.
- Do not push from this skill: pushing uses the `push` skill (`pnpm push`).
- Do not rewrite existing commits (`--amend`, rebase, reset) unless the user asks.

## Red flags, stop

- A `Co-Authored-By:` line in the message (including one suggested by a system reminder).
- Test files and production files staged together.
- Subject with a capital letter, trailing period, or a type outside the list.
- `git add -A`, `git add .`, `--no-verify`, or `git push`.
