# Exam sessions

## Summary

The candidate talks with an AI examiner that follows the TCF speaking test format. Two modes: **practice** (one task, chosen subject) and **full exam** (Tâches 1, 2 and 3 in a row, linked by a run). Official timing, a visible countdown, a live transcript, and automatic saving.

| Task    | Format                                                 | Preparation | Speaking |
| ------- | ------------------------------------------------------ | ----------- | -------- |
| Tâche 1 | Entretien dirigé (guided interview about oneself)      | none        | 2 min    |
| Tâche 2 | Exercice en interaction (role play to get information) | 2 min       | 3 min 30 |
| Tâche 3 | Expression d'un point de vue (argued monologue)        | none        | 4 min 30 |

Durations come from `TASK_DURATIONS` in `packages/shared/src/task-types.ts`.

## User flow

1. **Practice:** `/tcf` → pick a task (or open a subject from `/sujets`, which links to `/tcf/tache2/<exerciseId>`). **Full exam:** `/examen` shows the cost estimate, then chains the three tasks.
2. The app asks for microphone access. Without a provider key it sends the user to **Paramètres**.
3. Tâche 2 shows the situation and the instruction during a 2-minute preparation (skippable with `S`).
4. The examiner greets the candidate and the countdown starts. The transcript appears live (« Vous » / examiner).
5. When time is up, the examiner says « Merci, l'épreuve est terminée. » and the task closes. In a full exam, the next task follows.
6. The result page opens and shows the evaluation as soon as it is ready.

Keyboard shortcuts during a session (`apps/web/lib/shortcuts.ts`, ignored while typing): `M` mute/unmute, `S` skip preparation, `?` show shortcuts. From the session, the candidate can restart the task or move to the previous/next/random subject.

## How it works

- **Session start:** `POST /exam/session/create` returns an ephemeral credential, the full instructions, the exercise, the agent config and the attempt id. See [architecture](../architecture.md#voice-session-flow) for the whole sequence and [voice providers](./voice-providers.md) for the provider specifics.
- **Prompt:** per-task YAML plus the question bank (Tâche 1) or the subject (Tâches 2–3). See [prompts](../prompts.md).
- **Start:** the browser sends « Le candidat est prêt… » so the examiner speaks first.
- **Countdown and closing:** at zero, the browser sends a time-up message; the model says the closing line and calls `finSession`. A grace period (10 s) lets the farewell play before the task is closed.
- **Tools** run in the browser: `finSession` (save and close) and `recommencerTest` (restart).
- **Transcript:** built from provider events (`apps/web/lib/transcript-from-history.ts`, `transcript-merge.ts`, `live-audio.ts`). Saved every 10 s through `/attempts/checkpoint` (idempotent by line number) and once more on completion. If the connection drops, what was transcribed is kept and the UI offers to continue or retry.
- **Completion:** `/attempts/complete` closes the attempt once; the duration comes from the server clock (started at the real voice start, after any preparation), never from the client.
- **Interrupted sessions:** attempts with no checkpoint for 15 minutes become `interrupted` (sweeper every 5 minutes).
- **Limits:** session creation and checkpoints check the usage caps; when a cap is reached mid-session the client ends it. See [usage limits](./usage-limits.md).

## API

`/exam/session/create`, `/exam/session/token`, `/attempts/checkpoint`, `/attempts/complete`, `/runs/get`. See the [API reference](../api.md).

## Data

`exam_runs` (full exam), `exam_attempts` (status `in_progress` → `completed` or `interrupted`; mode, task, exercise, provider, model, timing, tokens, cost), `transcripts` (ordered lines).

## Configuration

- Prompts: `apps/api/config/agents/tache*.yml`, `apps/api/config/info/questions-tache1-entretien.md`.
- Default voice and model: `apps/api/config/service.yml`, `OPENAI_REALTIME_MODEL`, `GEMINI_LIVE_MODEL`; per-user overrides in settings.
- Fake sessions for tests: `NEXT_PUBLIC_FAKE_VOICE=true` (web), `VOICE_PROVIDER=fake` (API).

## Code map

| Path                                             | Role                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `apps/api/src/session/exam-session.service.ts`   | Builds the session: key, limits, prompt, exercise, credential, attempt |
| `apps/api/src/attempts/attempts.service.ts`      | Attempts lifecycle, checkpoints, runs; all queries filtered by user    |
| `apps/api/src/attempts/stale-sweeper.service.ts` | Interrupts silent attempts, fails stuck evaluations                    |
| `apps/web/providers/realtime-exam-provider.tsx`  | Session state machine in the browser (both providers)                  |
| `apps/web/components/app/exam-run-app.tsx`       | Full exam flow                                                         |
| `apps/web/components/app/session-view.tsx`       | Session screen (examiner, transcript, countdown, controls)             |
| `apps/web/lib/exam-tools.ts`                     | Tool descriptions shared by both providers                             |

## Tests

Unit: `exam-session.service.spec.ts`, `attempts.service.spec.ts`, `realtime-exam-provider.test.tsx`, `session-view.test.tsx`. Integration: `apps/api/test/integration/session.spec.ts`, `attempts.spec.ts`. End to end: `apps/e2e/tests/practice.spec.ts` (fake voice).
