/**
 * Default voice models when neither the user's settings nor the environment pick one.
 * OpenAI shuts down gpt-realtime-mini on 2027-01-20 (replacement: gpt-realtime-2.1-mini);
 * gemini-3.8-live is Google's default Live API model.
 */
export const DEFAULT_OPENAI_REALTIME_MODEL = 'gpt-realtime-2.1-mini';
export const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.8-live';
