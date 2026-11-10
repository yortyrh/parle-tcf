# 5. Gemini Live as a second voice backend (experimental)

Status: accepted, experimental

## Context

OpenAI Realtime connects from the browser over WebRTC; Gemini Live uses a WebSocket and raw PCM audio. Both must keep the user's long-lived key on the server.

## Decision

- `VoiceProvider` (server) mints a short-lived credential per backend; `VoiceProviderRegistry` picks it from the user's settings. Gemini uses single-use ephemeral tokens (`authTokens.create`, v1alpha), valid 30 min with a 2-minute window to open the session.
- The token does not lock the session config (instructions, voice): it is single-use and short-lived, and the config needs the exam prompt, which the browser already receives.
- The browser has a separate transport (`lib/gemini-live.ts`: AudioWorklet capture at 16 kHz, 24 kHz playback, input/output transcription → transcript lines). Persistence, timers, recording and evaluation are shared with the OpenAI path.
- Evaluation with a Gemini key uses `gemini-2.5-flash` through the AI SDK.

## Consequences

- Realtime cost for Gemini is not estimated (no price table), only the text evaluation is.
- Token usage reporting from the Live API is treated as cumulative and unverified.
- The Gemini path has no automated end-to-end test: it needs a real key and microphone.
