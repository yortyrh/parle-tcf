# parle-tcf documentation

Reference documentation for people and for LLM agents. Every page is plain Markdown. Feature pages follow the same template (Summary, User flow, How it works, API, Data, Configuration, Code map, Tests), so a reader can jump to the same section on any page. The machine-readable index is [`/llms.txt`](../llms.txt).

**Language:** documentation and code are in English. Exam content, model prompts and candidate-facing UI are in French, and are quoted in French here.

## Start here

| Page                              | What it covers                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------- |
| [Architecture](./architecture.md) | Packages, runtime components, the voice session flow, data model, security model |
| [Development](./development.md)   | Toolchain (Node.js LTS through pnpm), local setup, scripts, testing strategy     |
| [Deployment](./deployment.md)     | Docker, Railway, environment variables, migrations                               |
| [API reference](./api.md)         | Every HTTP route, its input/output schema and error codes                        |
| [Examiner prompts](./prompts.md)  | How the examiner prompts are built and the provider best practices they follow   |

## Features

| Feature                                                             | Summary                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Exam sessions](./features/exam-sessions.md)                        | Practice one task or take the full exam with an AI examiner, official timing, live transcript |
| [Voice providers](./features/voice-providers.md)                    | OpenAI Realtime (WebRTC) and Gemini Live (WebSocket), ephemeral credentials, models, voices   |
| [Provider keys and settings](./features/provider-settings.md)       | Bring your own API key, encrypted at rest, connection test, per-user models and voice         |
| [Evaluation](./features/evaluation.md)                              | CEFR grading of each task by a separate corrector, corrected transcript, overall exam level   |
| [Results, history and progress](./features/results-and-progress.md) | Result page, history, progression charts, attempt comparison, dashboard                       |
| [Exercise bank](./features/exercise-bank.md)                        | Monthly TCF subjects in PostgreSQL, the importer, the topic browser                           |
| [Accounts and authentication](./features/accounts.md)               | Email/password, GitHub/Google, email verification, password reset, account deletion           |
| [Usage limits and costs](./features/usage-limits.md)                | Cost estimates, per-attempt cost, daily minutes and monthly cost caps                         |
| [Audio recording](./features/audio-recording.md)                    | Opt-in recording of attempts in S3-compatible storage                                         |
| [Website, privacy and email](./features/website.md)                 | Landing page, SEO, privacy page, transactional emails                                         |

## Records

- [Architecture decision records](./adr) (ADR format: context, decision, consequences).
- [Original product requirements](./prd.md) (PRD, Nov 2026).
- [Changelog](../CHANGELOG.md) (Keep a Changelog format).

## Writing new pages

- One feature per file under `docs/features/`, named in kebab-case, using the template sections above. Leave a section out only when it does not apply.
- Link to code with repository-relative paths (`apps/api/src/...`), not line numbers: they drift.
- Add the page to this index and to [`/llms.txt`](../llms.txt).
- A decision with trade-offs goes into a new ADR (`docs/adr/NNNN-title.md`) instead.
