# CLAUDE.md

parle-tcf: practice for the **TCF speaking test** (Tâches 1–3) with an AI examiner. pnpm + Turborepo monorepo, Node 24 (`.nvmrc`).

- `apps/web`: Next.js App Router UI (shadcn, Tailwind 4). The voice session runs **in the browser** (OpenAI Realtime over WebRTC via `@openai/agents`, experimental Gemini Live). State lives in `providers/realtime-exam-provider.tsx`.
- `apps/api`: NestJS 11. Better Auth at `/api/auth/*`, oRPC contract in `src/contract/` (POST routes from `API_ROUTES`), session minting in `src/session/` + `src/providers/`, attempts, CEFR evaluation (`src/evaluation`, in-process), usage limits, consented audio (S3), mail (SMTP, Mailpit locally).
- `packages/db`: Drizzle schema (`src/schema`), SQL migrations, PGlite test helper (`@parle-tcf/db/testing`).
- `packages/shared`: zod schemas, `TaskType`, `API_ROUTES`. Builds to `dist/`; dependents use the built output (turbo `^build`).

**Language:** exam content, model prompts and candidate-facing UI are in **French**. Code, docs and commits are in **English**.

## Questions-only mode ("q:")

A message starting with `q:` is a question only: answer it, change nothing (no edits, commits, migrations, installs, data or infra changes). Read-only commands are fine.

## Commits and pushes

- Every commit uses the `commit` skill (`.claude/skills/commit/SKILL.md`): Conventional Commits, **no `Co-Authored-By` or any attribution** (commitlint enforces it), tests in a separate `test(...)` commit placed first.
- Every push uses the `push` skill: `pnpm push`, never `git push` (the pre-push hook rejects unverified commits).

## Tooling first: generate, then edit

If an installed tool or a repo script can produce something, run it and then edit the output. Do not write boilerplate by hand. Order: (1) look for a command (`pnpm run`, `--help`, `scripts/`), (2) run it, (3) adjust only what it did not do, (4) hand-write only when nothing covers the task. Generators run with `--no-spec`; tests come from the test agent. Never hand-edit generated artifacts a command overwrites (applied migrations).

| Task                                                                                                             | Command                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| New API feature (Nest module/service/controller + shared zod schemas + `API_ROUTES` + oRPC contract procedure)   | `pnpm scaffold:api-feature <kebab-name>`                                                                             |
| Single Nest piece (`apps/api`; fix imports to `.js` afterwards)                                                  | `pnpm --filter @parle-tcf/api exec nest g <schematic> <name> --no-spec`                                              |
| Web page in `app/(app)/<route>` (page + client view in `PageShell`)                                              | `pnpm scaffold:web-page <route> --title "Titre"`                                                                     |
| shadcn UI component (`apps/web`)                                                                                 | `pnpm --filter @parle-tcf/web exec shadcn add <component>`                                                           |
| New workspace package (`packages/<name>`)                                                                        | `pnpm scaffold:package <kebab-name>`                                                                                 |
| DB migration after editing `packages/db/src/schema`                                                              | `pnpm db:generate`                                                                                                   |
| Empty SQL migration (data migrations)                                                                            | `pnpm db:generate:custom <snake_name>`                                                                               |
| Apply migrations                                                                                                 | `pnpm db:migrate`                                                                                                    |
| Import new monthly subjects (`packages/importer`)                                                                | `pnpm exercises:import [--month YYYY-MM \| --all \| --file page.html --month YYYY-MM] [--dry-run]`                   |
| Rebuild the unapplied exercise data migration from a CSV export                                                  | `pnpm exercises:seed-sql <csv>`                                                                                      |
| Lint / format fixes                                                                                              | `pnpm lint:fix`, `pnpm format`                                                                                       |
| Unit tests with coverage thresholds (per package `vitest.config.ts`)                                             | `pnpm test:coverage`                                                                                                 |
| Integration tests (Supertest, Postgres + Mailpit in Testcontainers; Docker or Podman)                            | `pnpm test:integration`                                                                                              |
| End-to-end tests (Playwright + axe; needs `pnpm infra:up`, fake voice provider)                                  | `pnpm test:e2e`                                                                                                      |
| Mutation testing on files changed vs `origin/main` / on everything                                               | `pnpm mutate` / `pnpm mutate:full`                                                                                   |
| Deploy to Railway (guards, config check, api then web, health probes); `--check` validates only (`deploy` skill) | `pnpm deploy:railway [all\|api\|web] [--check]`                                                                      |
| Check every API env variable is documented in `apps/api/.env.example`                                            | `pnpm env-schema:check`                                                                                              |
| Dependencies                                                                                                     | `pnpm add` / `pnpm remove` (`-w` at root, `--filter` per package), never edit `package.json` or the lockfile by hand |

Scaffold logic lives in `scripts/scaffold.mjs` with pure, tested helpers in `scripts/lib/scaffold-*.mjs`. If a repeated change has no scaffold yet, add one (helper + spec + table row) instead of writing the boilerplate again. After changing a scaffold or the files it edits (`app.module.ts`, `exam.contract.ts`, `packages/shared/src/index.ts`), run `pnpm scaffold:smoke` on a clean tree: it scaffolds a throw-away feature and page, typechecks and lints them, then reverts.

When a new generator or script is added, add it to this table.

## Tests, agents and mutation testing

- **Separate agents:** one agent never writes both the tests and the production code of the same change. The test agent writes tests from the requirement (PRD, issue) and the public interface; the code agent makes them pass and must not edit them. If a test looks wrong, report it instead of changing it.
- **Separate commits:** the `test(...)` commit comes before the implementation commit.
- **Mutation mindset:** review every change as if mutants were applied (boundaries `<`/`<=`, negated conditions, removed guards such as `user_id` filters and auth checks, swapped operators, dropped return values) and add tests so each would fail. After any change, run `pnpm mutate` (Stryker, incremental, on the files changed against `origin/main`), aim for ≥ 80% on the touched files and report the score; surviving mutants are fixed by the test agent only. Ignore equivalent mutants with a short reason.
- **User isolation is in the API, not the DB** (no RLS): every query filters by `user_id`. Add a cross-user test with any new query.
- Unit tests are colocated (`*.test.ts` / `*.spec.ts`, Vitest everywhere). DB-backed specs run on PGlite with the real migrations.

## Commands

- Setup (Docker or Podman): `pnpm install && pnpm infra:up && pnpm setup:env && pnpm samples:seed` (the exercise bank arrives with the migrations). `infra:up` starts Postgres + Mailpit + RustFS S3 storage (`docker-compose.dev.yml`), migrates and creates the audio bucket with CORS; `setup:env` writes `apps/api/.env` and `apps/web/.env.local` (keeps secrets, OAuth credentials, port overrides; points `S3_*` at the local storage). `pnpm infra:down` / `infra:reset` stop or wipe it.
- Dev login: `developer@parle-tcf.local`, password from `pnpm local:credentials`.
- `pnpm dev`: web :3000 + api :3001. Mailpit UI: http://localhost:8025 (all local emails land there). The dev server builds into `apps/web/.next-dev` (production builds use `.next`, e2e `.next-e2e`), so `pnpm build` / `pnpm push` never break a running dev server.
- `pnpm verify`: full pipeline (node version, format:check, lint, typecheck, unit tests with coverage thresholds, script tests, build, env-schema:check). `pnpm push` runs it. Integration, e2e and mutation tests run separately (GitHub workflows `ci.yml`, `evals.yml`, `mutation.yml` are manual only: nothing runs on push).
- Lint and format: one root `eslint.config.mjs` (typed rules, `import/no-cycle`, Next/React/a11y for web) and one root `.prettierrc.json`; exam content under `apps/api/config/` is never reformatted.
- Test modes: `VOICE_PROVIDER=fake` (API) swaps OpenAI/Gemini and the corrector for local fakes (refused in production); web builds with `NEXT_PUBLIC_FAKE_VOICE=true` play a scripted session (`lib/fake-live.ts`). Integration specs use `apps/api/test/integration/create-test-app.ts`.
- Single test: `pnpm --filter @parle-tcf/<api|web|db|shared> exec vitest run <path>`.

## Architecture notes

- **Session flow:** browser → `POST /exam/session/create` → API decrypts the user's own provider key (AES-256-GCM, `src/crypto`), checks usage limits, loads the task YAML (`apps/api/config/agents/tache*.yml`) and exercise (Postgres), mints the provider secret, creates an attempt. The browser runs the session; the tools `finSession`/`recommencerTest` run client-side. A separate corrector evaluates the saved transcript.
- **Config:** `apps/api/config/` (YAML agents, `service.yml`, `français/rubrique-v1.md` = corrector prompt). `src/paths.ts` resolves it from the monorepo root too (Docker). Details: `EXERCISES.md`, `apps/api/config/SERVICE_CONFIG.md`.
- **Auth:** Better Auth in the API with the `bearer()` plugin. The web app is on another site, so it never relies on cookies: the token from `set-auth-token` is kept in localStorage (`apps/web/lib/session-token.ts`) and sent as `Authorization: Bearer`; `SessionAuthGuard` accepts bearer only. Email links (verify, reset, account deletion) open web pages that call the API. GitHub/Google: `GET /auth/oauth/:provider` → provider → `/auth/oauth/complete` (one-time code in `verification`) → web `/connexion/retour` → `POST /auth/oauth/exchange`. Local OAuth needs real dev apps (see README).
- **Email:** templates in `packages/email-templates` (React Email, preview with `pnpm --filter @parle-tcf/email-templates preview`); `MailService.send(template, to, props)`. Transport: `RESEND_API_KEY` > `SMTP_URL` > log (refused in production).
- **Exercise bank:** `exercises` (one row per distinct subject, dedupe key `content_hash` from `packages/db/src/exercise-bank.ts`), `exercise_occurrences` (month/part/position), `exercise_sessions`, `exercise_aliases`, `import_runs`. The importer makes plain HTTP requests only and stops when the site blocks it: never add browser automation or anything that works around bot protection.
- **Migrations at deploy:** Railway pre-deploy runs `node packages/db/dist/migrate.js`; `docker-compose.yml` has a one-shot `migrate` service.
- **Web bundle boundary:** `apps/web/lib/web-bundle-security.test.ts` fails if web code imports server-only modules or secrets.
- **Deploy:** Railway, two services (`apps/{api,web}/railway.json`, monorepo root). `NEXT_PUBLIC_EXAM_API_URL` is inlined at web build time; set the API's `CORS_ORIGINS` to the web URL. Order: API → web → CORS.
- **Decisions:** `docs/adr/`. Product requirements: `PRD · yorty-tcf preparación a la expresión oral del TCF.md`.
