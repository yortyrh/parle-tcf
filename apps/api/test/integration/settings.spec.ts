import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, providerSettings } from '@parle-tcf/db';
import type { ProviderSettings } from '@parle-tcf/shared';
import { type TestApp, createTestApp } from './create-test-app.js';
import {
  GEMINI_KEY,
  OPENAI_KEY,
  type TestUser,
  expectError,
  ok,
  rpc,
  signUpVerifiedUser,
} from './helpers.js';

const INVALID_KEY = `sk-invalid-${'x'.repeat(20)}`;

describe('settings (provider key, fake provider)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t?.close());

  const row = async (userId: string) => {
    const [r] = await t.db
      .select()
      .from(providerSettings)
      .where(eq(providerSettings.userId, userId));
    return r;
  };
  const get = async (u: TestUser) => ok<ProviderSettings>(await rpc(t, '/settings/get', u.token));
  const upsert = (u: TestUser, input: Record<string, unknown>) =>
    rpc(t, '/settings/upsert', u.token, input);

  it('starts unconfigured', async () => {
    const u = await signUpVerifiedUser(t, 'empty');
    expect(await get(u)).toEqual({
      configured: false,
      provider: 'openai',
      last4: null,
      realtimeModel: null,
      voice: null,
      textModel: null,
      verifiedAt: null,
    });
  });

  it('stores the key encrypted and only ever returns its last four characters', async () => {
    const u = await signUpVerifiedUser(t, 'store');
    const saved = ok<ProviderSettings>(await upsert(u, { apiKey: OPENAI_KEY, voice: 'verse' }));
    expect(saved).toMatchObject({
      configured: true,
      provider: 'openai',
      last4: OPENAI_KEY.slice(-4),
      voice: 'verse',
      verifiedAt: null,
    });
    expect(JSON.stringify(saved)).not.toContain(OPENAI_KEY);
    expect(await get(u)).toEqual(saved);

    const stored = await row(u.id);
    expect(stored.apiKeyCiphertext).not.toContain(OPENAI_KEY);
    expect(stored.keyVersion).toBe('v1');
  });

  it('requires a key for the first configuration', async () => {
    const u = await signUpVerifiedUser(t, 'firstkey');
    expectError(await upsert(u, { voice: 'verse' }), 400, 'BAD_REQUEST');
    expect(await row(u.id)).toBeUndefined();
  });

  it('updates models and voice without a new key, keeping the stored key', async () => {
    const u = await signUpVerifiedUser(t, 'models');
    ok(await upsert(u, { apiKey: OPENAI_KEY }));
    const before = await row(u.id);
    const updated = ok<ProviderSettings>(
      await upsert(u, { realtimeModel: 'gpt-realtime', textModel: 'gpt-4.1-mini' })
    );
    expect(updated).toMatchObject({
      configured: true,
      realtimeModel: 'gpt-realtime',
      textModel: 'gpt-4.1-mini',
      last4: OPENAI_KEY.slice(-4),
    });
    expect((await row(u.id)).apiKeyCiphertext).toBe(before.apiKeyCiphertext);
  });

  it('needs a new key to switch provider', async () => {
    const u = await signUpVerifiedUser(t, 'switch');
    ok(await upsert(u, { apiKey: OPENAI_KEY }));
    expectError(await upsert(u, { provider: 'gemini' }), 400, 'BAD_REQUEST');
    expect((await row(u.id)).provider).toBe('openai');
    const switched = ok<ProviderSettings>(
      await upsert(u, { provider: 'gemini', apiKey: GEMINI_KEY })
    );
    expect(switched).toMatchObject({ provider: 'gemini', last4: GEMINI_KEY.slice(-4) });
  });

  it.each([
    ['an OpenAI key for Gemini', { provider: 'gemini', apiKey: OPENAI_KEY }],
    ['a Gemini key for OpenAI', { provider: 'openai', apiKey: GEMINI_KEY }],
    ['a key shorter than 20 characters', { apiKey: 'sk-short' }],
  ])('rejects %s', async (_label, input) => {
    const u = await signUpVerifiedUser(t, 'badkey');
    expectError(await upsert(u, input), 400, 'BAD_REQUEST');
    expect(await row(u.id)).toBeUndefined();
  });

  describe('settings.test', () => {
    it('marks a working key as verified', async () => {
      const u = await signUpVerifiedUser(t, 'verify');
      ok(await upsert(u, { apiKey: OPENAI_KEY }));
      expect(ok(await rpc(t, '/settings/test', u.token))).toEqual({ ok: true });
      const verifiedAt = (await get(u)).verifiedAt;
      expect(verifiedAt).not.toBeNull();
      expect(Date.now() - Date.parse(verifiedAt as string)).toBeLessThan(30_000);
    });

    it('reports a rejected key ("invalid") without marking it verified', async () => {
      const u = await signUpVerifiedUser(t, 'invalid');
      ok(await upsert(u, { apiKey: INVALID_KEY }));
      expect(ok(await rpc(t, '/settings/test', u.token))).toEqual({
        ok: false,
        message: 'Clé API refusée (mode test)',
      });
      expect((await get(u)).verifiedAt).toBeNull();
    });

    it('resets the verification when the key changes', async () => {
      const u = await signUpVerifiedUser(t, 'rekey');
      ok(await upsert(u, { apiKey: OPENAI_KEY }));
      ok(await rpc(t, '/settings/test', u.token));
      ok(await upsert(u, { apiKey: `sk-another-${'y'.repeat(20)}` }));
      expect((await get(u)).verifiedAt).toBeNull();
    });

    it('answers PROVIDER_NOT_CONFIGURED without a key', async () => {
      const u = await signUpVerifiedUser(t, 'untested');
      expectError(await rpc(t, '/settings/test', u.token), 412, 'PROVIDER_NOT_CONFIGURED');
    });
  });

  it('deletes the key', async () => {
    const u = await signUpVerifiedUser(t, 'delete');
    ok(await upsert(u, { apiKey: OPENAI_KEY }));
    expect(ok(await rpc(t, '/settings/delete', u.token))).toEqual({ ok: true });
    expect(await row(u.id)).toBeUndefined();
    expect((await get(u)).configured).toBe(false);
    // Deleting twice is harmless.
    expect(ok(await rpc(t, '/settings/delete', u.token))).toEqual({ ok: true });
  });
});
