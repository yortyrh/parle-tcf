# GitHub configuration (monorepo root)

GitHub Actions workflows live here (no duplicate workflows under `apps/*/.github`).

## Active workflow

### [`workflows/ci.yml`](./workflows/ci.yml) — **CI**

**Triggers**: `push` and `pull_request` on branch `main`.

**Jobs**:

1. **Lint, format & types** — `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (Turborepo across `@yorty-tcf/web`, `@yorty-tcf/api`, etc.).
2. **Build & tests** — `pnpm build` then `pnpm test` (packages without a `test` script are skipped by Turborepo; `@yorty-tcf/api` may expose a placeholder script).

**Tooling**: Node.js **22**, **pnpm 10.33.0** (see root `package.json` → `packageManager`), install with `--frozen-lockfile`.

**Concurrency**: one active run per workflow and Git ref (`cancel-in-progress`).

---

## Workflows intentionally removed

### LiveKit sandbox sync (historical)

A manual workflow could push to a sandbox branch via the LiveKit ecosystem. It is no longer relevant: deployment target is **Railway** ([README.md](../README.md)).

### `template-check.yml` (LiveKit agent template)

It enforced “no lockfile in repo” — wrong for this monorepo where **`pnpm-lock.yaml` is committed**.

### `.github/assets`

Optional folder for images used in GitHub-facing docs.

---

## Summary

| File | When it runs | Purpose |
| --- | --- | --- |
| `ci.yml` | Push / PR on `main` | Quality + build + tests |

Railway hosting (**API** + **Web** only, no agent service): [README.md](../README.md), [AGENTS.md](../AGENTS.md), [DOCKER.md](../DOCKER.md).
