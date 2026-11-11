# Voice providers

## Summary

Two speech-to-speech backends, chosen per user in **Paramètres**: **OpenAI Realtime** (default, WebRTC) and **Gemini Live** (experimental, WebSocket). Audio always flows directly between the browser and the provider. The API only mints a short-lived credential with the user's own key. See [ADR 0005](../adr/0005-gemini-live-provider.md).

## How it works

| Aspect               | OpenAI Realtime                                                             | Gemini Live                                                                                                      |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Credential           | `POST /v1/realtime/client_secrets` with model and voice                     | Single-use ephemeral auth token (`authTokens.create`, `v1alpha`): valid 30 min, must open a session within 2 min |
| Transport (browser)  | WebRTC via `@openai/agents` (`RealtimeSession`, `OpenAIRealtimeWebRTC`)     | WebSocket via `@google/genai` (`ai.live.connect`), AudioWorklet capture at 16 kHz, 24 kHz playback               |
| Default model        | `gpt-realtime-2.1-mini` (`DEFAULT_OPENAI_REALTIME_MODEL`)                   | `gemini-3.8-live` (`DEFAULT_GEMINI_LIVE_MODEL`)                                                                  |
| Default voice        | `marin` (`service.yml`)                                                     | `Puck`                                                                                                           |
| Turn detection       | Semantic VAD, `eagerness: 'low'`                                            | Automatic activity detection, `END_SENSITIVITY_LOW`                                                              |
| Candidate transcript | `gpt-4o-mini-transcribe`, `language: 'fr'`                                  | `inputAudioTranscription`                                                                                        |
| Examiner transcript  | Output audio transcript events                                              | `outputAudioTranscription`                                                                                       |
| Noise handling       | Browser echo cancellation + noise suppression; `near_field` noise reduction | Browser echo cancellation + noise suppression                                                                    |
| Usage for cost       | `response.done` token usage                                                 | Usage metadata                                                                                                   |

Model resolution (`ExamSessionService.resolveRealtimeModel`): the user's saved model, else `GEMINI_LIVE_MODEL` (Gemini), else `service.yml` `llm.model` when it is not `realtime`, else `OPENAI_REALTIME_MODEL`, else the shared default.

The attempt records its provider and model. If the user switches provider in the middle of a task, `/exam/session/token` refuses with `CONFLICT`.

Low eagerness / low end-of-speech sensitivity are deliberate: candidates are language learners who pause to find their words, and the default settings ended their turn too early.

## Configuration

- `apps/api/config/service.yml`: default OpenAI voice and model.
- `OPENAI_REALTIME_MODEL`, `GEMINI_LIVE_MODEL`: deployment-wide defaults.
- Per user: provider, realtime model and voice in **Paramètres** ([provider settings](./provider-settings.md)).
- `VOICE_PROVIDER=fake` (API) and `NEXT_PUBLIC_FAKE_VOICE=true` (web) replace both providers with local fakes for tests.

## Code map

| Path                                                 | Role                                             |
| ---------------------------------------------------- | ------------------------------------------------ |
| `apps/api/src/providers/voice-provider.ts`           | `VoiceProvider` interface and registry           |
| `apps/api/src/providers/openai-realtime.provider.ts` | OpenAI client secret and key check               |
| `apps/api/src/providers/gemini-live.provider.ts`     | Gemini ephemeral token and key check             |
| `apps/api/src/providers/fake-voice.provider.ts`      | Test provider                                    |
| `apps/web/providers/realtime-exam-provider.tsx`      | OpenAI session in the browser                    |
| `apps/web/lib/gemini-live.ts`                        | Gemini session in the browser                    |
| `apps/web/lib/fake-live.ts`                          | Scripted session for end-to-end tests            |
| `packages/shared/src/models.ts`, `pricing.ts`        | Default models and token prices                  |
| `patches/@openai__agents-*.patch`                    | Lenient parsing of malformed tool-call arguments |

## Tests

`openai-realtime.provider.spec.ts`, `gemini-live.provider.spec.ts`, `exam-session.service.spec.ts`, `apps/web/lib/gemini-live.test.ts`, `realtime-exam-provider.test.tsx`.
