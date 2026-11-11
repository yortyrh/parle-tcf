import { describe, expect, it } from 'vitest';
import { DEFAULT_GEMINI_LIVE_MODEL, DEFAULT_OPENAI_REALTIME_MODEL } from './models';

describe('default voice models', () => {
  it('defaults OpenAI to gpt-realtime-2.1-mini (gpt-realtime-mini retires on 2027-01-20)', () => {
    expect(DEFAULT_OPENAI_REALTIME_MODEL).toBe('gpt-realtime-2.1-mini');
  });

  it('defaults Gemini to the listed Live model gemini-3.8-live', () => {
    expect(DEFAULT_GEMINI_LIVE_MODEL).toBe('gemini-3.8-live');
  });
});
