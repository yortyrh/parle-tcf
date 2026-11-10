# GitHub configuration (monorepo root)

GitHub Actions workflows live here (no duplicate workflows under `apps/*/.github`).

## Active workflow

### [`workflows/ci.yml`](./workflows/ci.yml) — **CI**

**Triggers**: manual only (`workflow_dispatch`) for now. Locally, `pnpm verify` runs the same checks and `pnpm push` enforces it.

**Jobs**:

1. **Lint, format & types** — `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (Turborepo across `@parle-tcf/web`, `@parle-tcf/api` and `@parle-tcf/shared`).
2. **Build & tests** — `pnpm build` then `pnpm test`.

**Tooling**: Node.js **24** (matches `.nvmrc`), **pnpm 10.33.0** (root `package.json` → `packageManager`), install with `--frozen-lockfile`.

**Concurrency**: one active run per workflow and Git ref (`cancel-in-progress`).

---

## Summary

| File        | When it runs | Purpose                 |
| ----------- | ------------ | ----------------------- |
| `ci.yml`    | Manual       | Quality + build + tests |
| `evals.yml` | Manual       | Corrector evals         |

Hosting (**API** + **Web** on Railway): [README.md](../README.md), [CLAUDE.md](../CLAUDE.md), [DOCKER.md](../DOCKER.md).
