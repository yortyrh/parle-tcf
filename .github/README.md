# GitHub configuration (monorepo root)

GitHub Actions workflows live here (no duplicate workflows under `apps/*/.github`).

## Active workflow

### [`workflows/ci.yml`](./workflows/ci.yml) — **CI**

**Triggers**: `push` and `pull_request` on branch `main`.

**Jobs**:

1. **Lint, format & types** — `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (Turborepo across `@parle-tcf/web`, `@parle-tcf/api` and `@parle-tcf/shared`).
2. **Build & tests** — `pnpm build` then `pnpm test`.

**Tooling**: Node.js **24** (matches `.nvmrc`), **pnpm 10.33.0** (root `package.json` → `packageManager`), install with `--frozen-lockfile`.

**Concurrency**: one active run per workflow and Git ref (`cancel-in-progress`).

---

## Summary

| File | When it runs | Purpose |
| --- | --- | --- |
| `ci.yml` | Push / PR on `main` | Quality + build + tests |

Hosting (**API** + **Web** on Railway): [README.md](../README.md), [AGENTS.md](../AGENTS.md), [DOCKER.md](../DOCKER.md).
