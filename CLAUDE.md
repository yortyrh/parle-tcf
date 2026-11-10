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

| Task                                                                                                           | Command                                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| New API feature (Nest module/service/controller + shared zod schemas + `API_ROUTES` + oRPC contract procedure) | `pnpm scaffold:api-feature <kebab-name>`                                                                             |
| Single Nest piece (`apps/api`; fix imports to `.js` afterwards)                                                | `pnpm --filter @parle-tcf/api exec nest g <schematic> <name> --no-spec`                                              |
| Web page in `app/(app)/<route>` (page + client view in `PageShell`)                                            | `pnpm scaffold:web-page <route> --title "Titre"`                                                                     |
| shadcn UI component (`apps/web`)                                                                               | `pnpm --filter @parle-tcf/web exec shadcn add <component>`                                                           |
| New workspace package (`packages/<name>`)                                                                      | `pnpm scaffold:package <kebab-name>`                                                                                 |
| DB migration after editing `packages/db/src/schema`                                                            | `pnpm db:generate`                                                                                                   |
| Empty SQL migration (data migrations)                                                                          | `pnpm db:generate:custom <snake_name>`                                                                               |
| Apply migrations / seed exercises                                                                              | `pnpm db:migrate` / `pnpm db:seed`                                                                                   |
| Lint / format fixes                                                                                            | `pnpm lint:fix`, `pnpm format`                                                                                       |
| Dependencies                                                                                                   | `pnpm add` / `pnpm remove` (`-w` at root, `--filter` per package), never edit `package.json` or the lockfile by hand |

Scaffold logic lives in `scripts/scaffold.mjs` with pure, tested helpers in `scripts/lib/scaffold-*.mjs`. If a repeated change has no scaffold yet, add one (helper + spec + table row) instead of writing the boilerplate again. After changing a scaffold or the files it edits (`app.module.ts`, `exam.contract.ts`, `packages/shared/src/index.ts`), run `pnpm scaffold:smoke` on a clean tree: it scaffolds a throw-away feature and page, typechecks and lints them, then reverts.

When a new generator or script is added, add it to this table.

## Tests, agents and mutation testing

- **Separate agents:** one agent never writes both the tests and the production code of the same change. The test agent writes tests from the requirement (PRD, issue) and the public interface; the code agent makes them pass and must not edit them. If a test looks wrong, report it instead of changing it.
- **Separate commits:** the `test(...)` commit comes before the implementation commit.
- **Mutation mindset:** review every change as if mutants were applied (boundaries `<`/`<=`, negated conditions, removed guards such as `user_id` filters and auth checks, swapped operators, dropped return values) and add tests so each would fail. Aim for ≥ 80% mutation score on touched code once Stryker is installed; ignore equivalent mutants with a short reason.
- **User isolation is in the API, not the DB** (no RLS): every query filters by `user_id`. Add a cross-user test with any new query.
- Unit tests are colocated (`*.test.ts` / `*.spec.ts`, Vitest everywhere). DB-backed specs run on PGlite with the real migrations.

## Commands

- Setup (Docker or Podman): `pnpm install && pnpm infra:up && pnpm setup:env && pnpm db:seed && pnpm samples:seed`. `infra:up` starts Postgres + Mailpit (`docker-compose.dev.yml`) and migrates; `setup:env` writes `apps/api/.env` and `apps/web/.env.local` (keeps secrets, OAuth credentials, port overrides). `pnpm infra:down` / `infra:reset` stop or wipe it.
- Dev login: `developer@parle-tcf.local`, password from `pnpm local:credentials`.
- `pnpm dev`: web :3000 + api :3001. Mailpit UI: http://localhost:8025 (all local emails land there).
- `pnpm verify`: full pipeline (node version, format:check, lint, typecheck, tests, script tests, build). `pnpm push` runs it.
- Single test: `pnpm --filter @parle-tcf/<api|web|db|shared> exec vitest run <path>`.

## Architecture notes

- **Session flow:** browser → `POST /exam/session/create` → API decrypts the user's own provider key (AES-256-GCM, `src/crypto`), checks usage limits, loads the task YAML (`apps/api/config/agents/tache*.yml`) and exercise (Postgres), mints the provider secret, creates an attempt. The browser runs the session; the tools `finSession`/`recommencerTest` run client-side. A separate corrector evaluates the saved transcript.
- **Config:** `apps/api/config/` (YAML agents, `service.yml`, `français/rubrique-v1.md` = corrector prompt). `src/paths.ts` resolves it from the monorepo root too (Docker). Details: `EXERCISES.md`, `apps/api/config/SERVICE_CONFIG.md`.
- **Auth:** Better Auth in the API with the `bearer()` plugin. The web app is on another site, so it never relies on cookies: the token from `set-auth-token` is kept in localStorage (`apps/web/lib/session-token.ts`) and sent as `Authorization: Bearer`; `SessionAuthGuard` accepts bearer only. Email links (verify, reset, account deletion) open web pages that call the API. GitHub/Google: `GET /auth/oauth/:provider` → provider → `/auth/oauth/complete` (one-time code in `verification`) → web `/connexion/retour` → `POST /auth/oauth/exchange`. Local OAuth needs real dev apps (see README).
- **Email:** templates in `packages/email-templates` (React Email, preview with `pnpm --filter @parle-tcf/email-templates preview`); `MailService.send(template, to, props)`. Transport: `RESEND_API_KEY` > `SMTP_URL` > log (refused in production).
- **Migrations at deploy:** Railway pre-deploy runs `node packages/db/dist/migrate.js`; `docker-compose.yml` has a one-shot `migrate` service.
- **Web bundle boundary:** `apps/web/lib/web-bundle-security.test.ts` fails if web code imports server-only modules or secrets.
- **Deploy:** Railway, two services (`apps/{api,web}/railway.json`, monorepo root). `NEXT_PUBLIC_EXAM_API_URL` is inlined at web build time; set the API's `CORS_ORIGINS` to the web URL. Order: API → web → CORS.
- **Decisions:** `docs/adr/`. Product requirements: `PRD · yorty-tcf preparación a la expresión oral del TCF.md`.
