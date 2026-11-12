# GitHub workflows

GitHub Actions workflows live in this folder (no duplicate workflows under `apps/*/.github`). This file is not at `.github/README.md` on purpose: GitHub would show it on the repository home page instead of the root `README.md`.

## Triggers

Every workflow is **manual only** (`workflow_dispatch`): nothing runs on push, pull requests or a schedule. Start them from the Actions tab or with `gh workflow run <file>`. Locally, `pnpm verify` runs the quality checks and `pnpm push` enforces it.

### [`workflows/ci.yml`](./ci.yml) — **CI**

Quality (lint, format, types) → unit tests with coverage + build → integration (Testcontainers) → end-to-end (Playwright + axe), plus the scaffold smoke test.

**Tooling**: Node.js **26 LTS** (`.nvmrc`, mirrors `devEngines.runtime`), pnpm from the root `package.json` → `packageManager` (12.18.0), install with `--frozen-lockfile`.

**Concurrency**: one active run per workflow and Git ref (`cancel-in-progress`).

---

## Summary

| File           | When it runs | Purpose                 |
| -------------- | ------------ | ----------------------- |
| `ci.yml`       | Manual       | Quality + build + tests |
| `evals.yml`    | Manual       | Corrector evals         |
| `mutation.yml` | Manual       | Mutation testing        |

Hosting (**API** + **Web** on Railway): [README.md](../../README.md), [CLAUDE.md](../../CLAUDE.md), [DOCKER.md](../../DOCKER.md).

## Social preview

[`social-preview.png`](../social-preview.png) (1280×640) is the repository's social card, rendered from [`social-preview.html`](../social-preview.html) (site colours and fonts). GitHub has no API for it: upload the PNG under **Settings → General → Social preview**. To change it, edit the HTML and run `pnpm readme:images`, which renders it at 1280×640 over the PNG (the root `README.md` shows the same image), then upload it again.
