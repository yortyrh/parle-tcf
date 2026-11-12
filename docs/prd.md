# PRD · parle-tcf: TCF speaking test preparation

Nov 8, 2026 · @Yorty · Original product requirements, translated from Spanish. Kept as the record of what was planned; [`docs/features`](./features) describes what the app does today.

## Summary and context

parle-tcf (formerly yorty-tcf) goes from a stateless exam simulator to a multi-user platform that turns every TCF speaking session into measurable learning: CEFR evaluation per criterion, corrected transcript, progress history, and a model and API key chosen by each user.

**Starting point** (private repository `yorty-tcf-livekit`):

- Turborepo + pnpm monorepo: Next.js 15 (`apps/web`), NestJS (`apps/api`), and shared Zod types and schemas (`packages/shared`).
- The examiner talks to the candidate through OpenAI Realtime over direct WebRTC from the browser (`@openai/agents`). The API only issues the ephemeral `client_secret` with a single server-side `OPENAI_API_KEY`.
- It covers the TCF speaking test (tasks 1 to 3, exercises in SQLite generated from a CSV) and sections A and B of the TEF.
- There are no users, attempts are not saved, and there is a single test file.

**Why the rebuild:** in the portfolio, this project is the one that demonstrates real-time voice, multi-provider LLMs, secret handling, evals and cost control. Today it only demonstrates the first. It comes second in the portfolio order because it reuses the authentication and the resubuild template.

## Goals, non-goals and metrics

**Goals**

1. A candidate can practise the TCF speaking test (3 tasks, 12 minutes) and, at the end, receives an estimated CEFR level with feedback per criterion.
2. Each user sees their progress: attempt history, comparison between attempts on the same subject, and a dashboard per task.
3. Each user uses their own API key and model, stored securely, without changing the WebRTC flow.
4. Evaluation quality is measurable with evals against a human grader.

**Non-goals**

- Listening, reading and writing comprehension, and any other TCF section.
- The TEF (removed).
- Issuing an official score or presenting the product as affiliated with France Éducation international.
- Payments or subscription plans in this version.
- A native mobile app.

**Success metrics**

| Metric                       | Target                                                    | How it is measured                                  |
| ---------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| Level agreement with grader  | ≥ 70 % exact match and ≥ 95 % within one level            | Eval suite on answers of known level                |
| Time to evaluation           | ≤ 30 s after the task ends                                | Trace between end of session and saved evaluation   |
| API key leaks                | 0 responses returning the key to the browser              | API tests and bundle review                         |
| User isolation               | 0 accesses to another user's attempts                     | Authorization tests in CI                           |
| Recorded cost                | 100 % of attempts with Realtime minutes and tokens        | Query on `exam_attempts`                            |
| API coverage                 | ≥ 80 %                                                    | CI on every PR                                      |

The agreement thresholds are an initial proposal; they are adjusted once the first eval baseline exists.

## Users and use cases

**Primary user:** a TCF candidate (immigration, citizenship or studies) who wants to practise speaking with a realistic examiner and find out their level. **Secondary user:** someone reviewing the portfolio (recruiter or technical interviewer), who should understand the product in 30 seconds from the README or the demo.

| Use case              | Story                                                                                                     | Priority |
| --------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| Full exam             | As a candidate, I want to take the 3 tasks in a row with the official timing to simulate exam day.        | P0       |
| Free practice         | As a candidate, I want to practise one task to work on my weak spot.                                      | P0       |
| Evaluation            | As a candidate, I want to see my estimated CEFR level and feedback per criterion after each task.         | P0       |
| Corrected transcript  | As a candidate, I want to see my sentences with the errors marked and an improved version next to them.   | P0       |
| Account and API key   | As a user, I want to sign up and use my own API key and model.                                            | P0       |
| History and progress  | As a candidate, I want to see my previous attempts and my progress per task.                              | P1       |
| Repeat a subject      | As a candidate, I want to repeat a subject and compare both attempts.                                     | P1       |
| Recording             | As a candidate, I want to listen to my answer again, if I allow it to be recorded.                        | P2       |
| Second voice provider | As a user, I want to choose Gemini Live instead of OpenAI Realtime.                                       | P2       |

## Scope: preliminary clean-up

Before adding features, the repository is reduced to what the product is: TCF speaking only, without LiveKit or the TEF.

**Name.** Rename the GitHub repository (the old URL redirects), the `yorty-tcf-livekit` package and the `@yorty-tcf` scope. Candidates: `parle-tcf` (makes it clear it is speaking only) or `prepa-tcf`. The README includes a note that it is not official nor affiliated with France Éducation international.

**Remove LiveKit.** The code no longer uses it; leftovers remain in:

- `packages/shared/src/messages.ts` (comment about data channels)
- reference blocks in `apps/api/config/service.yml`
- `README.md`, `.github/workflows/README.md`, `AGENTS.md`, `SERVICE_CONFIG.md`, `CHANGELOG.md`
- the `.claude/` commands
- check whether the Socket.io gateway is still needed; if not, remove it

**Remove the TEF.** Delete:

- the `app/(app)/tef` route, `tef-app-config.ts` and the `tef-*` components
- `config/tef-exercices` and its copy in `public/`
- the `generate-tef-*`, `sync-tef-to-web` and `rename-tef-images` scripts
- the `tef-section-*` YAML files
- the TEF branches of `exercise.service.ts` and `exam-session.service.ts`
- then update `EXERCISES.md`

**Definition of done:** `grep -riE "livekit|\btef\b"` returns nothing outside the historical CHANGELOG, and the build and tests pass. (Without `\b`, "tef" appears inside "plateforme".)

## Functional requirements

**FR1 · Session modes**

- FR1.1 Full exam: tasks 1, 2 and 3 in a row, with the official timing and a visible timer.
- FR1.2 Free practice: the user picks the task and the subject; no strict time limit, with the official time as a reference.
- FR1.3 The Realtime examiner follows each task's script and closes the task when time runs out.

**FR2 · Exercise bank**

- FR2.1 Exercises are loaded from the current CSV with an idempotent seed script.
- FR2.2 Extend the task 2 and 3 bank from the CSV.
- FR2.3 The user can repeat a specific subject.

**FR3 · Evaluation per task**

- FR3.1 When each task ends, the transcript goes through a CEFR rubric and an estimated level (A1 to C2) is saved.
- FR3.2 Feedback per criterion: task fulfilment, coherence, vocabulary, grammar and fluency, each with its level and one or two sentences on how to improve.
- FR3.3 The full exam also shows an overall estimate.
- FR3.4 Every evaluation shows a notice that it is indicative and not official.
- FR3.5 The model output is validated with a Zod schema; when it does not match, the call is retried.

**FR4 · Corrected transcript**

- FR4.1 Two-column view: the candidate's sentences with errors marked by type, and the improved version next to them.
- FR4.2 The examiner's turns are distinguished from the candidate's.

**FR5 · History and progress**

- FR5.1 Each attempt stores mode, task, subject, transcript, duration, evaluation, model used and cost.
- FR5.2 Progress dashboard per task with the level over time.
- FR5.3 Side-by-side comparison of two attempts on the same subject.
- FR5.4 The user can delete an attempt or their whole account with its data.

**FR6 · Audio recording (P2)**

- FR6.1 Off by default; enabled with explicit consent.
- FR6.2 If pronunciation is evaluated, it is done from the audio with a notice that it is approximate; the transcript alone does not reflect it.

**FR7 · Accounts**

- FR7.1 Sign-up and sign-in with email and OAuth through Better Auth in NestJS, reusing the resubuild work.
- FR7.2 Email verification and password recovery.

**FR8 · Provider, model and API key per user**

- FR8.1 The user stores their API key; it never goes back to the browser, not even masked beyond the last 4 characters.
- FR8.2 Per-user settings: realtime model and voice for the speaking session, text model for grading.
- FR8.3 A "test connection" button validates the key with a minimal call.
- FR8.4 The API decrypts the key only to request the ephemeral `client_secret`; the browser's WebRTC flow does not change.
- FR8.5 Provider layer: OpenAI Realtime in the first version, Gemini Live as the second voice provider, Vercel AI SDK for grading.

**FR9 · Cost limits**

- FR9.1 Record Realtime minutes and tokens per attempt.
- FR9.2 Configurable limits per user (minutes per day or cost per month); when reached, the session does not start and the reason is explained.

## Non-functional requirements

| Area                | Requirement                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret encryption   | API keys encrypted with AES-256-GCM, a random IV per record and the master key outside the database (environment variable or secret manager). Master key rotation without data loss. |
| Secret exposure     | No endpoint returns the decrypted key; logs and error reporting redact it. The browser only receives the ephemeral `client_secret`.                                                 |
| Authorization       | Every query filters by `userId`; a user never reads or changes another user's attempts, transcripts or settings.                                                                   |
| Privacy             | Audio only with consent; account deletion removes attempts, transcripts, evaluations, audio and keys. Privacy policy on the website.                                                 |
| Performance         | Evaluation available ≤ 30 s after a task ends; the voice session starts ≤ 3 s after pressing "start".                                                                              |
| Resilience          | If evaluation fails, the attempt is still saved and the evaluation can be re-run. If WebRTC drops, what was transcribed so far is saved.                                           |
| Observability       | Structured logs in web and API, with the cost per attempt as an attribute.                                                                                                          |
| Accessibility       | Keyboard navigation and AA contrast on the result and history views.                                                                                                              |
| Interface language  | Interface in French; the evaluation and feedback also in French.                                                                                                                   |
| Portfolio standards | 30-second README with a GIF, architecture diagram, demo or video, `docker compose up`, `.env.example`, ADRs, licence and CHANGELOG.                                               |

## Architecture and data model

The monorepo and the current voice flow stay; what is new is the user layer, PostgreSQL persistence and the evaluation pipeline after each task.

| Piece      | Technology                                      | Change                                                                       |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Web        | Next.js 15 (`apps/web`)                         | New views: provider settings, result, history, comparison                    |
| API        | NestJS (`apps/api`)                             | Modules `auth`, `provider-settings`, `attempts`, `evaluation`, `usage`       |
| Shared     | Zod (`packages/shared`)                         | Evaluation, attempt and settings schemas                                     |
| Voice      | OpenAI Realtime over WebRTC (`@openai/agents`)  | No browser change; the `client_secret` is requested with the user's key      |
| Grading    | Vercel AI SDK + Zod schema                      | New                                                                          |
| Database   | PostgreSQL + Drizzle                            | Replaces SQLite; reuses the resubuild `db` package, which also uses Drizzle   |
| Auth       | Better Auth                                     | New, reused from resubuild                                                   |
| Audio (P2) | S3-compatible (R2 / MinIO)                      | New                                                                          |

**Tables**

| Table               | Main fields                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`             | id, email, name, created (plus Better Auth's own tables: sessions, accounts, verifications)                                                          |
| `provider_settings` | user_id, provider, encrypted_api_key, iv, auth_tag, last 4, realtime_model, voice, text_model, verified_at                                           |
| `exercises`         | id, task (1-3), subject, instruction, origin (CSV row)                                                                                              |
| `exam_attempts`     | id, user_id, mode, exercise_id, started, finished, duration_s, provider, model, realtime_minutes, input_tokens, output_tokens, estimated_cost, audio_key |
| `transcripts`       | id, attempt_id, order, speaker (examiner or candidate), text, corrected_version, errors (JSON)                                                       |
| `evaluations`       | id, attempt_id, global_level, levels per criterion, feedback (JSON), corrector_model, rubric_version                                                |

`exercises` is added to the plan's five tables to load the CSV into PostgreSQL. `rubric_version` makes it possible to compare evaluations made with different rubrics.

## Quality: evals and tests

**Grading evals.** A set of sample transcripts with a known CEFR level (scored by a grader) goes through each grading model. Measured:

- exact level match and match within one level;
- agreement per criterion;
- stability: the same transcript evaluated 5 times must give the same level;
- cost and latency per evaluation.

Results are published in the README as a table per model and run in CI when the rubric or the prompt changes.

**Tests**

| Layer           | What is tested                                                                                   | Tool                                 |
| --------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Encryption      | Round trip, different IV per record, failure with a tampered auth_tag, master key rotation        | Unit tests                           |
| Authorization   | No user reads or changes another user's attempts, transcripts or settings                         | Unit tests + PostgreSQL in container |
| Session service | Issuing the `client_secret` with the user's key, cost limits, missing or invalid key              | Unit tests with a fake provider      |
| Evaluation      | Schema validation, retry on invalid output, saving even when it fails                             | Unit tests                           |
| Seed            | The CSV script is idempotent                                                                      | Unit tests                           |
| End to end      | Sign-up, key setup, full exam, view result and history                                            | Playwright with a fake realtime session |
| Bundle          | No key or provider client with a secret in the web bundle                                         | Build test                           |

## Phases and acceptance criteria

Each phase ends with a verifiable criterion before the next one starts; phase 0 is short and unblocks everything else. Phases 0 to 2 form the first publishable version; phase 3 is what turns the project into a strong AI portfolio piece.

## Risks and open decisions

| Risk                                          | Impact                                 | Mitigation                                                               |
| --------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| LLM evaluation disagrees with a grader        | The user gets a misleading level       | Evals with a baseline, rubric version, notice that it is indicative      |
| Few sample answers with a known level         | Unreliable evals                       | Start with a small documented set; grow it with each phase               |
| The Realtime transcription has its own errors | Candidates are penalised for errors they did not make | Show the transcript and warn that it comes from speech recognition |
| High Realtime cost for the full exam          | Unexpected bills for the user          | Cost shown before and after the session, per-user limits                 |
| API key leak                                  | Loss of trust and cost for the user    | AES-256-GCM, master key outside the database, bundle and log tests       |
| Differences between voice providers           | Gemini Live does not fit the abstraction | Design the provider interface with OpenAI and validate it with Gemini before closing it |
| Confusion with the official exam              | Brand risk                             | Unofficial name and non-affiliation notice in the README and website     |

**Open decisions**

- [x] Final name: `parle-tcf`.
- [x] The Socket.io gateway is removed; evaluation status is polled.
- [x] Interface language: French only.
- [ ] Who acts as the grader to create the reference answers for the evals.
- [ ] Default cost limit values.
- [x] Audio recording stays P2.
