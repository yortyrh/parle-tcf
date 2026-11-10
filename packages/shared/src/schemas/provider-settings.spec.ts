import { describe, expect, it } from 'vitest';
import { upsertProviderSettingsInputSchema as schema } from './provider-settings';

describe('upsertProviderSettingsInputSchema', () => {
  it('checks the key prefix of the chosen provider', () => {
    const openai = 'sk-' + 'a'.repeat(30);
    const gemini = 'AIza' + 'b'.repeat(30);
    expect(schema.safeParse({ provider: 'openai', apiKey: openai }).success).toBe(true);
    expect(schema.safeParse({ provider: 'gemini', apiKey: gemini }).success).toBe(true);
    expect(schema.safeParse({ provider: 'gemini', apiKey: openai }).success).toBe(false);
    expect(schema.safeParse({ provider: 'openai', apiKey: gemini }).success).toBe(false);
    expect(schema.safeParse({ apiKey: gemini }).success).toBe(false); // defaults to openai
    expect(schema.safeParse({ provider: 'gemini' }).success).toBe(true); // keep stored key
  });
});
