import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API_ROUTES } from '@parle-tcf/shared';
import { type TestApp, createTestApp } from './create-test-app.js';
import { rpc, signUpVerifiedUser } from './helpers.js';

/** Routes that answer without a session. */
const PUBLIC_ROUTES = new Set<string>([API_ROUTES.exercisesFeatured]);
const PROTECTED = Object.entries(API_ROUTES).filter(([, path]) => !PUBLIC_ROUTES.has(path));

describe('SessionAuthGuard on every protected route', () => {
  let t: TestApp;
  let token: string;

  beforeAll(async () => {
    t = await createTestApp();
    ({ token } = await signUpVerifiedUser(t, 'guard'));
  });
  afterAll(() => t?.close());

  it('covers every API route but the public teaser', () => {
    expect(PROTECTED.length).toBe(Object.keys(API_ROUTES).length - 1);
  });

  it.each(PROTECTED)('%s (%s) answers 401 without a token', async (_name, path) => {
    const res = await rpc(t, path, null);
    expect(res.status).toBe(401);
  });

  it.each(PROTECTED)('%s (%s) answers 401 with an unknown token', async (_name, path) => {
    const res = await rpc(t, path, 'not-a-session-token');
    expect(res.status).toBe(401);
  });

  it.each(PROTECTED)('%s (%s) answers 401 to a non-bearer scheme', async (_name, path) => {
    const res = await t
      .http()
      .post(path)
      .set('Authorization', `Basic ${Buffer.from('a:b').toString('base64')}`)
      .send({});
    expect(res.status).toBe(401);
  });

  it.each(PROTECTED)('%s (%s) exists and lets a signed-in user through', async (_name, path) => {
    // Inputs are empty, so some routes reject them, but never with 401 or 404.
    const res = await rpc(t, path, token);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(404);
  });

  it('serves the public teaser without a session', async () => {
    const res = await rpc(t, API_ROUTES.exercisesFeatured, null);
    expect(res.status).toBe(200);
  });

  it('serves the health check without a session', async () => {
    const res = await t.http().get('/health');
    expect(res.status).toBe(200);
    expect((res.body as { status: string }).status).toBe('ok');
  });
});
