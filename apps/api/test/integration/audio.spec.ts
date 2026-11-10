import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, userPreferences } from '@parle-tcf/db';
import { type TestApp, createTestApp } from './create-test-app.js';
import {
  type TestUser,
  configureProvider,
  expectError,
  ok,
  rpc,
  signUpVerifiedUser,
  startSession,
} from './helpers.js';

/**
 * The suite runs without S3: recording is reported unavailable and the upload
 * routes answer the documented BAD_REQUEST. Presign constraints are pinned by
 * src/audio/s3-audio-storage.spec.ts.
 */
describe('audio without object storage', () => {
  let t: TestApp;
  let u: TestUser;
  let attemptId: string;

  beforeAll(async () => {
    t = await createTestApp();
    u = await signUpVerifiedUser(t, 'audio');
    await configureProvider(t, u.token);
    ({ attemptId } = await startSession(t, u.token));
  });
  afterAll(() => t?.close());

  const consentAt = async () => {
    const [row] = await t.db.select().from(userPreferences).where(eq(userPreferences.userId, u.id));
    return row?.audioConsentAt ?? null;
  };

  it('reports recording as unavailable, without consent by default', async () => {
    expect(ok(await rpc(t, '/audio/status', u.token))).toEqual({
      available: false,
      consent: false,
    });
  });

  it('stores and withdraws consent', async () => {
    expect(ok(await rpc(t, '/audio/consent', u.token, { consent: true }))).toEqual({
      available: false,
      consent: true,
    });
    expect(await consentAt()).toBeInstanceOf(Date);
    expect(ok(await rpc(t, '/audio/consent', u.token, { consent: false }))).toEqual({
      available: false,
      consent: false,
    });
    expect(await consentAt()).toBeNull();
  });

  it('upload-url answers BAD_REQUEST: recording is not available on this server', async () => {
    ok(await rpc(t, '/audio/consent', u.token, { consent: true }));
    const res = await rpc(t, '/audio/upload-url', u.token, {
      attemptId,
      contentType: 'audio/webm',
    });
    expectError(res, 400, 'BAD_REQUEST');
    expect((res.body as { message: string }).message).toBe(
      "L'enregistrement audio n'est pas disponible sur ce serveur."
    );
  });

  it('confirm answers the same BAD_REQUEST', async () => {
    const res = await rpc(t, '/audio/confirm', u.token, { attemptId });
    expectError(res, 400, 'BAD_REQUEST');
    expect((res.body as { message: string }).message).toBe(
      "L'enregistrement audio n'est pas disponible sur ce serveur."
    );
  });

  it('download-url returns no url for an attempt without recording', async () => {
    expect(ok(await rpc(t, '/audio/download-url', u.token, { attemptId }))).toEqual({ url: null });
    expectError(
      await rpc(t, '/audio/download-url', u.token, { attemptId: crypto.randomUUID() }),
      404,
      'NOT_FOUND'
    );
  });

  it('validates the content type before anything else', async () => {
    expectError(
      await rpc(t, '/audio/upload-url', u.token, { attemptId, contentType: 'audio/wav' }),
      400,
      'BAD_REQUEST'
    );
  });

  it('deleting an attempt works without storage', async () => {
    const { attemptId: other } = await startSession(t, u.token);
    expect(ok(await rpc(t, '/attempts/delete', u.token, { attemptId: other }))).toEqual({
      ok: true,
    });
  });
});
