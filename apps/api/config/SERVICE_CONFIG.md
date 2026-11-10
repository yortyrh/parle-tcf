# `service.yml` — global Realtime settings

This file lives at **`apps/api/config/service.yml`**. The NestJS **`ExamConfigService`** loads it (cached) for **`ExamSessionService.createSession`**.

## What the API actually uses

| Field       | Effect                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `llm.voice` | OpenAI Realtime output voice; passed to `POST /v1/realtime/client_secrets` and echoed in `agentConfig.voice`.                                                                    |
| `llm.model` | If `realtime` (or empty treated as default branch), resolved via `process.env.OPENAI_REALTIME_MODEL` or a code default. Any other string is used as the model id sent to OpenAI. |

`llm.provider` and `llm.modalities` are **not** read by the current session path; they remain for documentation / future use.

## Example `llm` block

```yaml
llm:
  provider: "openai"
  model: "realtime"
  voice: "alloy"
  modalities:
    - "text"
    - "audio"
```

### OpenAI Realtime voices

`alloy` (default), `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin` and `cedar` (OpenAI recommends `marin` and `cedar` for the best quality). `fable`, `onyx` and `nova` are text-to-speech voices only and are rejected by Realtime. A per-user voice set in the settings page overrides this value; Gemini uses its own voices (default `Puck`).

## Environment override

Set **`OPENAI_REALTIME_MODEL`** in `apps/api/.env` (or the host environment) to pick a specific Realtime model when `llm.model` is `realtime`. See `ExamSessionService.resolveRealtimeModel` in `apps/api/src/session/exam-session.service.ts`.

## Where task prompts live

Per-task instructions, greetings, and settings are in **`config/agents/{taskType}.yml`** (`tache1.yml`, `tache2.yml`, `tache3.yml`). See **[EXERCISES.md](../../../EXERCISES.md)** at the repo root.

## Code references

- Loader: `apps/api/src/config/exam-config.service.ts` (`loadServiceConfig`)
- Consumer: `apps/api/src/session/exam-session.service.ts`

After editing `service.yml`, restart the API process so the in-memory cache reloads.
