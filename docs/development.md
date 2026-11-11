# Development

## Toolchain: Node.js LTS through pnpm

The root `package.json` pins the whole toolchain, and pnpm installs it:

| Tool    | Pin                                                                      | Who installs it                                                                        |
| ------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| pnpm    | `packageManager: pnpm@12.18.0`                                           | Any pnpm ≥ 9.7 switches to the pinned version automatically.                           |
| Node.js | `devEngines.runtime: node 26.13.1` (current **LTS**, `onFail: download`) | `pnpm install` downloads it into `node_modules/.bin`; every `pnpm run` script uses it. |

`.nvmrc` mirrors the Node.js version for editors, nvm and `actions/setup-node`.

**Install once:**

```bash
# 1. pnpm (standalone installer, no Node.js needed). Other options: https://pnpm.io/installation
curl -fsSL https://get.pnpm.io/install.sh | sh -

# 2. Node.js LTS as your global `node`, installed by pnpm itself
pnpm runtime set node lts -g
```

Step 2 is only needed to run `node` outside pnpm scripts: inside the repository, `pnpm install` already provides the pinned LTS. `pnpm verify` fails fast (`scripts/check-node-version.mjs`) when the Node.js major differs from `.nvmrc`.

Do not install dependencies with npm or Yarn, and never edit dependencies in `package.json` or `pnpm-lock.yaml` by hand: use `pnpm add` / `pnpm remove` (`-w` at the root, `--filter <package>` otherwise). The dependencies allowed to run install scripts are listed under `allowBuilds` in `pnpm-workspace.yaml`; pnpm fails the install when a new dependency with a build script is in neither list.

To upgrade later: `pnpm self-update` (pnpm) and `pnpm runtime set node lts` (Node.js in `devEngines.runtime`; then update `.nvmrc` and the `node:<major>` images in the Dockerfiles).

## Local setup

Requires Docker or Podman for PostgreSQL, Mailpit and the S3-compatible storage.

```bash
pnpm install
pnpm infra:up        # Postgres + Mailpit + RustFS, migrations, exercise bank, audio bucket
pnpm setup:env       # writes apps/api/.env and apps/web/.env.local (secrets generated once, then kept)
pnpm samples:seed    # dev users; passwords: pnpm local:credentials
pnpm dev             # web http://localhost:3000, api http://localhost:3001
```

- Exercise bank: without `EXERCISE_DATA_TOKEN`, `pnpm infra:up` loads the original sample bank (32 subjects). Maintainers with access to the private data repository run `EXERCISE_DATA_TOKEN=$(gh auth token) pnpm exercises:load --force` for the real one; anyone can add real subjects with `pnpm exercises:import`.
- Dev login: `developer@parle-tcf.local`, password from `pnpm local:credentials`. Then add an OpenAI or Gemini API key under **Paramètres**.
- Email: every local email lands in Mailpit (http://localhost:8025).
- Audio storage: RustFS on http://localhost:9000 (console on http://localhost:9001).
- Ports: set `POSTGRES_PORT`, `MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT`, `STORAGE_PORT` and `STORAGE_CONSOLE_PORT` before `pnpm setup:env` and `pnpm infra:up`; they are saved in `apps/api/.env`.
- Stop / wipe: `pnpm infra:down` / `pnpm infra:reset`.
- The dev server builds into `apps/web/.next-dev` (production builds use `.next`, e2e `.next-e2e`), so a build never breaks a running dev server.
- Social sign-in locally needs real GitHub/Google development apps; see [accounts](./features/accounts.md#configuration).

## Generate, then edit

If a tool or a repository script can produce something, run it and edit the output instead of writing boilerplate by hand. The full table is in [`CLAUDE.md`](../CLAUDE.md#tooling-first-generate-then-edit); the main entries:

| Task                                                                    | Command                                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| New API feature (module, service, controller, schemas, route, contract) | `pnpm scaffold:api-feature <kebab-name>`                   |
| New web page under `app/(app)/<route>`                                  | `pnpm scaffold:web-page <route> --title "Titre"`           |
| New workspace package                                                   | `pnpm scaffold:package <kebab-name>`                       |
| shadcn component                                                        | `pnpm --filter @parle-tcf/web exec shadcn add <component>` |
| Migration after a schema change / empty data migration                  | `pnpm db:generate` / `pnpm db:generate:custom <name>`      |
| Apply migrations                                                        | `pnpm db:migrate`                                          |

## Quality gates

| Command                 | What it runs                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`           | Node version check, format check, lint (typed rules), typecheck, unit tests with coverage thresholds, script tests, build, env documentation check |
| `pnpm test:integration` | API integration tests (Supertest) against PostgreSQL and Mailpit in Testcontainers                                                                 |
| `pnpm test:e2e`         | Playwright + axe against a production build with the fake voice provider (needs `pnpm infra:up`)                                                   |
| `pnpm mutate`           | Stryker mutation testing on the files changed against `origin/main` (target ≥ 80 %)                                                                |
| `pnpm push`             | Runs `pnpm verify`, then pushes; the pre-push hook rejects commits that were not verified                                                          |

The GitHub workflows (`ci.yml`, `evals.yml`, `mutation.yml`) are manual only; nothing runs on push.

## Testing strategy

- **Unit tests** are colocated (`*.test.ts(x)` / `*.spec.ts`) and run with Vitest everywhere. Database-backed specs run on PGlite with the real migrations (`@parle-tcf/db/testing`, which caches a migrated snapshot).
- **Integration tests** (`apps/api/test/integration`) boot the real Nest app through `create-test-app.ts` with Postgres and Mailpit containers.
- **End-to-end tests** (`apps/e2e`) drive the real web app. `NEXT_PUBLIC_FAKE_VOICE=true` plays a scripted session (`apps/web/lib/fake-live.ts`), and `VOICE_PROVIDER=fake` swaps the API's providers and corrector for local fakes (refused in production).
- **Separate authors:** whoever writes the tests from the requirement does not write the code, and tests land in a `test(...)` commit before the implementation.
- **Mutation mindset:** review every change as if mutants were applied (boundaries, negated conditions, removed `user_id` filters or auth checks) and add a test that would fail.
- **User isolation:** every new query gets a cross-user test.

## Conventions

- Conventional Commits, enforced by commitlint; no AI attribution trailers.
- One root ESLint config (typed rules, `import/no-cycle`, Next/React/a11y for web) and one Prettier config. Exam content under `apps/api/config/` is never reformatted.
- Code, comments, docs and commits in English; exam content, prompts and UI in French.
