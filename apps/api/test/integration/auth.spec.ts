import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, session, user, verification } from '@parle-tcf/db';
import { TEST_WEB_URL, type TestApp, createTestApp } from './create-test-app.js';
import {
  PASSWORD,
  rpc,
  signIn,
  signUp,
  signUpVerifiedUser,
  uniqueEmail,
  webLinkInEmail,
} from './helpers.js';
import { messagesTo } from './mailpit.js';

const HANDOFF_PREFIX = 'oauth-handoff:';

describe('auth (Better Auth under /api/auth, OAuth handoff)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t?.close());

  const userRow = async (email: string) => {
    const [row] = await t.db.select().from(user).where(eq(user.email, email));
    return row;
  };

  const sessionOf = (token: string) =>
    t.http().get('/api/auth/get-session').set('Authorization', `Bearer ${token}`);

  describe('email sign-up, verification and sign-in', () => {
    it('signs up without a session and emails a verification link to the web app', async () => {
      const email = uniqueEmail('signup');
      const res = await signUp(t, email);

      expect(res.status).toBe(200);
      expect(res.headers['set-auth-token']).toBeUndefined();
      expect((res.body as { token: string | null }).token).toBeNull();
      expect((await userRow(email))?.emailVerified).toBe(false);

      const link = await webLinkInEmail(email, '/verifier-email');
      expect(link.searchParams.get('token')).toBeTruthy();
    });

    it('refuses to sign in before the email is verified', async () => {
      const email = uniqueEmail('unverified');
      await signUp(t, email);
      const res = await t
        .http()
        .post('/api/auth/sign-in/email')
        .send({ email, password: PASSWORD });
      expect(res.status).toBe(403);
      expect(res.headers['set-auth-token']).toBeUndefined();
    });

    it('verifies the email from the link, signs the user in, then allows password sign-in', async () => {
      const email = uniqueEmail('verify');
      await signUp(t, email);
      const link = await webLinkInEmail(email, '/verifier-email');

      const verified = await t
        .http()
        .get('/api/auth/verify-email')
        .query({ token: link.searchParams.get('token') });
      expect(verified.status).toBe(200);
      const autoToken = verified.headers['set-auth-token'];
      expect(autoToken).toBeTruthy();
      expect((await userRow(email))?.emailVerified).toBe(true);
      expect(((await sessionOf(autoToken)).body as { user: { email: string } }).user.email).toBe(
        email
      );

      const token = await signIn(t, email);
      const me = await sessionOf(token);
      expect(me.status).toBe(200);
      expect((me.body as { user: { email: string } }).user.email).toBe(email);
    });

    it('rejects a forged verification token', async () => {
      const email = uniqueEmail('forged');
      await signUp(t, email);
      const res = await t.http().get('/api/auth/verify-email').query({ token: 'not-a-real-token' });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.headers['set-auth-token']).toBeUndefined();
      expect((await userRow(email))?.emailVerified).toBe(false);
    });

    it('rejects a wrong password', async () => {
      const { email } = await signUpVerifiedUser(t, 'wrongpw');
      const res = await t
        .http()
        .post('/api/auth/sign-in/email')
        .send({ email, password: 'not-the-password' });
      expect(res.status).toBe(401);
      expect(res.headers['set-auth-token']).toBeUndefined();
    });

    it('authenticates with the bearer token only, never with a cookie', async () => {
      const { token } = await signUpVerifiedUser(t, 'bearer');
      const cookieOnly = await rpc(t, '/settings/get', null).set(
        'Cookie',
        `better-auth.session_token=${token}`
      );
      expect(cookieOnly.status).toBe(401);
      expect((await rpc(t, '/settings/get', token)).status).toBe(200);
    });
  });

  describe('password reset', () => {
    it('emails a reset link, sets the new password and revokes the old sessions', async () => {
      const { email, token: oldToken } = await signUpVerifiedUser(t, 'reset');
      const before = (await messagesTo(email)).length;

      const requested = await t.http().post('/api/auth/request-password-reset').send({ email });
      expect(requested.status).toBe(200);
      const link = await webLinkInEmail(email, '/reinitialiser');
      expect((await messagesTo(email)).length).toBe(before + 1);

      const newPassword = 'a-brand-new-password-2';
      const reset = await t
        .http()
        .post('/api/auth/reset-password')
        .send({ token: link.searchParams.get('token'), newPassword });
      expect(reset.status).toBe(200);

      const oldPassword = await t
        .http()
        .post('/api/auth/sign-in/email')
        .send({ email, password: PASSWORD });
      expect(oldPassword.status).toBe(401);
      expect(await signIn(t, email, newPassword)).toBeTruthy();
      // revokeSessionsOnPasswordReset: the session opened before the reset is gone.
      expect((await rpc(t, '/settings/get', oldToken)).status).toBe(401);
    });

    it('does not reveal whether an address exists', async () => {
      const email = uniqueEmail('nobody');
      const res = await t.http().post('/api/auth/request-password-reset').send({ email });
      expect(res.status).toBe(200);
      expect(await messagesTo(email)).toEqual([]);
    });

    it('rejects a reset with an unknown token', async () => {
      const res = await t
        .http()
        .post('/api/auth/reset-password')
        .send({ token: 'forged-token', newPassword: 'whatever-password-3' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('OAuth handoff (/auth/oauth/*)', () => {
    /** A real session token, stored as OAuthController.complete does it. */
    const issueCode = async (expiresInMs = 120_000) => {
      const { id, token: bearer } = await signUpVerifiedUser(t, 'oauth');
      const [row] = await t.db.select().from(session).where(eq(session.userId, id));
      const code = `code-${crypto.randomUUID()}`;
      await t.db.insert(verification).values({
        identifier: `${HANDOFF_PREFIX}${code}`,
        value: row.token,
        expiresAt: new Date(Date.now() + expiresInMs),
      });
      return { code, sessionToken: row.token, bearer };
    };

    const exchange = (body: unknown) =>
      t
        .http()
        .post('/auth/oauth/exchange')
        .send(body as object);

    it('trades a one-time code for a working session token', async () => {
      const { code, sessionToken } = await issueCode();
      const res = await exchange({ code });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ token: sessionToken });
      expect((await rpc(t, '/settings/get', sessionToken)).status).toBe(200);
    });

    it('accepts each code once', async () => {
      const { code } = await issueCode();
      expect((await exchange({ code })).status).toBe(200);
      const again = await exchange({ code });
      expect(again.status).toBe(401);
      const rows = await t.db
        .select()
        .from(verification)
        .where(eq(verification.identifier, `${HANDOFF_PREFIX}${code}`));
      expect(rows).toEqual([]);
    });

    it('refuses an expired code', async () => {
      const { code } = await issueCode(-1_000);
      expect((await exchange({ code })).status).toBe(401);
    });

    it('refuses an unknown code and does not touch other codes', async () => {
      const { code } = await issueCode();
      expect((await exchange({ code: 'unknown-code' })).status).toBe(401);
      const rows = await t.db
        .select()
        .from(verification)
        .where(eq(verification.identifier, `${HANDOFF_PREFIX}${code}`));
      expect(rows).toHaveLength(1);
    });

    it.each([
      ['no code', {}],
      ['an empty code', { code: '' }],
      ['a code over 200 characters', { code: 'x'.repeat(201) }],
    ])('answers 400 for %s', async (_label, body) => {
      expect((await exchange(body)).status).toBe(400);
    });

    it('404s for a provider without credentials', async () => {
      expect((await t.http().get('/auth/oauth/github')).status).toBe(404);
      expect((await t.http().get('/auth/oauth/unknown')).status).toBe(404);
    });

    it('sends the browser back to the sign-in error page when no session came back', async () => {
      const res = await t.http().get('/auth/oauth/complete').query({ redirect: '/sujets' });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`${TEST_WEB_URL}/connexion?erreur=oauth`);
    });
  });
});
