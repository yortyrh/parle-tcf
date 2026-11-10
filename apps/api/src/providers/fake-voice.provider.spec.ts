import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAKE_CLIENT_SECRET, FakeVoiceProvider } from './fake-voice.provider.js';

const PARAMS = { model: 'gpt-realtime-mini', voice: 'alloy' };

describe('FakeVoiceProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['openai', 'gemini'] as const)('answers as the %s provider', (id) => {
    expect(new FakeVoiceProvider(id).id).toBe(id);
  });

  it('mints a recognizable secret carrying the provider and the key length, not the key', async () => {
    const key = 'sk-0123456789abcdefghij';
    const secret = await new FakeVoiceProvider('gemini').mintClientSecret(key, PARAMS);
    expect(secret).toBe(`${FAKE_CLIENT_SECRET}:gemini:${key.length}`);
    expect(secret).not.toContain(key);
    expect(FAKE_CLIENT_SECRET).toBe('fake-client-secret');
  });

  it('accepts any key without "invalid"', async () => {
    const provider = new FakeVoiceProvider('openai');
    await expect(provider.verifyKey('sk-anything-goes-here')).resolves.toEqual({ ok: true });
    await expect(provider.verifyKey('')).resolves.toEqual({ ok: true });
  });

  it.each(['invalid', 'sk-invalid-key', 'sk-key-invalid'])('rejects %j', async (key) => {
    await expect(new FakeVoiceProvider('openai').verifyKey(key)).resolves.toEqual({
      ok: false,
      message: 'Clé API refusée (mode test)',
    });
  });

  it('is case-sensitive about "invalid"', async () => {
    await expect(new FakeVoiceProvider('openai').verifyKey('sk-INVALID')).resolves.toEqual({
      ok: true,
    });
  });

  it('never calls the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new FakeVoiceProvider('openai');
    await provider.mintClientSecret('sk-x', PARAMS);
    await provider.verifyKey('sk-x');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
