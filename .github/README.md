# GitHub configuration (monorepo root)

GitHub Actions workflows live here (no duplicate workflows under `apps/*/.github`).

## Triggers

Every workflow is **manual only** (`workflow_dispatch`): nothing runs on push, pull requests or a schedule. Start them from the Actions tab or with `gh workflow run <file>`. Locally, `pnpm verify` runs the quality checks and `pnpm push` enforces it.

### [`workflows/ci.yml`](./workflows/ci.yml) — **CI**

Quality (lint, format, types) → unit tests with coverage + build → integration (Testcontainers) → end-to-end (Playwright + axe), plus the scaffold smoke test.

**Tooling**: Node.js **24** (matches `.nvmrc`), **pnpm 10.33.0** (root `package.json` → `packageManager`), install with `--frozen-lockfile`.

**Concurrency**: one active run per workflow and Git ref (`cancel-in-progress`).

---

## Summary

| File           | When it runs | Purpose                 |
| -------------- | ------------ | ----------------------- |
| `ci.yml`       | Manual       | Quality + build + tests |
| `evals.yml`    | Manual       | Corrector evals         |
| `mutation.yml` | Manual       | Mutation testing        |

Hosting (**API** + **Web** on Railway): [README.md](../README.md), [CLAUDE.md](../CLAUDE.md), [DOCKER.md](../DOCKER.md).
