import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { account, eq, session, user, verification } from '@parle-tcf/db';
import { type TestDb, createTestDb } from '@parle-tcf/db/testing';
import { type Env, getEnv, resetEnvCache } from '../config/env.js';
import type { MailService } from '../mail/mail.service.js';
import {
  AUTH_BASE_PATH,
  createAuth,
  enabledSocialProviders,
  socialProvidersFromEnv,
  webLink,
} from './better-auth.js';

const API = 'http://api.parle.test';
const WEB = 'http://app.parle.test';
const PASSWORD = 'correct horse battery';

function stubEnv(extra: Record<string, string> = {}) {
  vi.stubEnv('DATABASE_URL', 'postgresql://u:p@127.0.0.1:5432/db');
  vi.stubEnv('BETTER_AUTH_SECRET', 's'.repeat(32));
  vi.stubEnv('ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  vi.stubEnv('ENCRYPTION_KEY_CURRENT', 'v1');
  vi.stubEnv('BETTER_AUTH_URL', API);
  vi.stubEnv('WEB_URL', WEB);
  vi.stubEnv('CORS_ORIGINS', '');
  for (const key of [
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ]) {
    vi.stubEnv(key, '');
  }
  for (const [key, value] of Object.entries(extra)) vi.stubEnv(key, value);
  resetEnvCache();
}

const tokenOf = (link: string) => new URL(link).searchParams.get('token');

describe('webLink', () => {
  it('builds a web URL carrying the token', () => {
    expect(webLink('https://app.test', '/reinitialiser', 'abc')).toBe(
      'https://app.test/reinitialiser?token=abc'
    );
  });

  it('encodes the token and keeps a base path', () => {
    const link = webLink('https://app.test/fr', 'compte/suppression', 'a b&c=d');
    expect(link).toBe('https://app.test/fr/compte/suppression?token=a+b%26c%3Dd');
    expect(tokenOf(link)).toBe('a b&c=d');
  });
});

describe('social providers', () => {
  const env = (values: Partial<Env>) => values as Env;

  it('enables nothing by default', () => {
    expect(socialProvidersFromEnv(env({}))).toEqual({});
    expect(enabledSocialProviders(env({}))).toEqual([]);
  });

  it('needs both the client id and the secret', () => {
    expect(socialProvidersFromEnv(env({ GITHUB_CLIENT_ID: 'id' }))).toEqual({});
    expect(socialProvidersFromEnv(env({ GITHUB_CLIENT_SECRET: 'secret' }))).toEqual({});
    expect(socialProvidersFromEnv(env({ GOOGLE_CLIENT_ID: 'id' }))).toEqual({});
    expect(socialProvidersFromEnv(env({ GOOGLE_CLIENT_SECRET: 'secret' }))).toEqual({});
  });

  it('enables each provider with its own credentials', () => {
    expect(
      socialProvidersFromEnv(
        env({
          GITHUB_CLIENT_ID: 'gh-id',
          GITHUB_CLIENT_SECRET: 'gh-secret',
          GOOGLE_CLIENT_ID: 'g-id',
          GOOGLE_CLIENT_SECRET: 'g-secret',
        })
      )
    ).toEqual({
      github: { clientId: 'gh-id', clientSecret: 'gh-secret' },
      google: { clientId: 'g-id', clientSecret: 'g-secret' },
    });
    expect(
      enabledSocialProviders(env({ GOOGLE_CLIENT_ID: 'g-id', GOOGLE_CLIENT_SECRET: 'g-secret' }))
    ).toEqual(['google']);
  });

  describe('from the process environment', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      resetEnvCache();
    });

    it('reads getEnv() by default', () => {
      stubEnv({ GITHUB_CLIENT_ID: 'gh-id', GITHUB_CLIENT_SECRET: 'gh-secret' });
      expect(enabledSocialProviders()).toEqual(['github']);
      expect(socialProvidersFromEnv()).toEqual({
        github: { clientId: 'gh-id', clientSecret: 'gh-secret' },
      });
    });
  });
});

describe('createAuth (Better Auth on PGlite)', () => {
  let testDb: TestDb;
  let mail: {
    sendVerificationEmail: ReturnType<typeof vi.fn>;
    sendPasswordResetEmail: ReturnType<typeof vi.fn>;
    sendDeleteAccountEmail: ReturnType<typeof vi.fn>;
  };
  let beforeDelete: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());

  beforeEach(async () => {
    await testDb.truncateAll();
    mail = {
      sendVerificationEmail: vi.fn(async () => undefined),
      sendPasswordResetEmail: vi.fn(async () => undefined),
      sendDeleteAccountEmail: vi.fn(async () => undefined),
    };
    beforeDelete = vi.fn(async () => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  const build = (extra: Record<string, string> = {}) => {
    stubEnv(extra);
    return createAuth(testDb.db, mail as unknown as MailService, beforeDelete);
  };

  const signUp = (auth: ReturnType<typeof build>, email: string) =>
    auth.api.signUpEmail({ body: { email, password: PASSWORD, name: 'Alice' } });

  it('serves under /api/auth from BETTER_AUTH_URL', () => {
    const auth = build();
    expect(AUTH_BASE_PATH).toBe('/api/auth');
    expect(auth.options.basePath).toBe(AUTH_BASE_PATH);
    expect(auth.options.baseURL).toBe(getEnv().BETTER_AUTH_URL);
    expect(auth.options.trustedOrigins).toEqual([WEB]);
  });

  it('trusts the web app and the extra CORS origins', () => {
    const auth = build({ CORS_ORIGINS: 'https://preview.parle.test/, https://other.test' });
    expect(auth.options.trustedOrigins).toEqual([
      WEB,
      'https://preview.parle.test',
      'https://other.test',
    ]);
  });

  it('enables only the configured social providers', () => {
    const auth = build({ GOOGLE_CLIENT_ID: 'g-id', GOOGLE_CLIENT_SECRET: 'g-secret' });
    expect(Object.keys(auth.options.socialProviders ?? {})).toEqual(['google']);
  });

  it('names the app and wires the Drizzle adapter to the auth tables on Postgres', async () => {
    const auth = build();
    expect(auth.options.appName).toBe('parle-tcf');
    const ctx = await auth.$context;
    const adapterOptions = (
      ctx.adapter as unknown as { options: { provider: string; schema: Record<string, unknown> } }
    ).options;
    expect(adapterOptions.provider).toBe('pg');
    expect(adapterOptions.schema).toEqual({ user, session, account, verification });
  });

  it('keeps sessions for 7 days, refreshed at most daily', () => {
    const auth = build();
    expect(auth.options.session).toEqual({ expiresIn: 604_800, updateAge: 86_400 });
  });

  it('links GitHub and Google sign-ins to an existing account', () => {
    const auth = build();
    expect(auth.options.account).toEqual({
      accountLinking: { enabled: true, trustedProviders: ['github', 'google'] },
    });
  });

  describe('with email verification (default)', () => {
    it('emails a verification link to the web app on sign-up and returns no session', async () => {
      const auth = build();
      const result = await signUp(auth, 'alice@test.local');

      expect(result.token).toBeNull();
      await vi.waitFor(() => expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1));
      const [to, link] = mail.sendVerificationEmail.mock.calls[0] as [string, string];
      expect(to).toBe('alice@test.local');
      expect(link.startsWith(`${WEB}/verifier-email?token=`)).toBe(true);
      expect(tokenOf(link)).toBeTruthy();
    });

    it('signs the user in when the emailed link is used', async () => {
      const auth = build();
      await signUp(auth, 'alice@test.local');
      await vi.waitFor(() => expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1));
      const link = mail.sendVerificationEmail.mock.calls[0]?.[1] as string;

      const res = await auth.api.verifyEmail({
        query: { token: tokenOf(link) ?? '' },
        returnHeaders: true,
      });
      const bearer = res.headers.get('set-auth-token');
      expect(bearer).toEqual(expect.any(String));
      const signedIn = await auth.api.getSession({
        headers: new Headers({ authorization: `Bearer ${bearer}` }),
      });
      expect(signedIn?.user.email).toBe('alice@test.local');
      expect(signedIn?.user.emailVerified).toBe(true);
    });

    it('refuses to sign in before the email is verified', async () => {
      const auth = build();
      await signUp(auth, 'alice@test.local');
      await expect(
        auth.api.signInEmail({ body: { email: 'alice@test.local', password: PASSWORD } })
      ).rejects.toMatchObject({ status: 'FORBIDDEN' });
    });
  });

  describe('without email verification', () => {
    const open = () => build({ AUTH_EMAIL_VERIFICATION_ENABLED: 'false' });

    it('signs the user in at once and sends no email', async () => {
      const auth = open();
      const result = await signUp(auth, 'bob@test.local');
      expect(result.token).toEqual(expect.any(String));
      expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('rejects a password shorter than 8 characters', async () => {
      const auth = open();
      await expect(
        auth.api.signUpEmail({ body: { email: 'c@test.local', password: '1234567', name: 'C' } })
      ).rejects.toMatchObject({ status: 'BAD_REQUEST' });
      const rows = await testDb.db.select().from(user).where(eq(user.email, 'c@test.local'));
      expect(rows).toEqual([]);
    });

    it('authenticates with the bearer token, not with a cookie', async () => {
      const auth = open();
      const { token } = await signUp(auth, 'bob@test.local');
      const session = await auth.api.getSession({
        headers: new Headers({ authorization: `Bearer ${token}` }),
      });
      expect(session?.user.email).toBe('bob@test.local');
      const none = await auth.api.getSession({
        headers: new Headers({ authorization: 'Bearer not-a-token' }),
      });
      expect(none).toBeNull();
    });

    it('emails a password reset link to the web app', async () => {
      const auth = open();
      await signUp(auth, 'bob@test.local');
      await auth.api.requestPasswordReset({ body: { email: 'bob@test.local' } });

      await vi.waitFor(() => expect(mail.sendPasswordResetEmail).toHaveBeenCalledTimes(1));
      const [to, link] = mail.sendPasswordResetEmail.mock.calls[0] as [string, string];
      expect(to).toBe('bob@test.local');
      expect(link.startsWith(`${WEB}/reinitialiser?token=`)).toBe(true);
    });

    it('opens a 7-day session on sign-up', async () => {
      const auth = open();
      const before = Date.now();
      const { token } = await signUp(auth, 'bob@test.local');
      const [row] = await testDb.db
        .select()
        .from(session)
        .where(eq(session.token, token ?? ''));
      const week = 7 * 24 * 3600_000;
      expect(row?.expiresAt.getTime()).toBeGreaterThanOrEqual(before + week - 5_000);
      expect(row?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + week + 5_000);
    });

    it('gives the reset link one hour, then signs every session out on reset', async () => {
      const auth = open();
      const { token } = await signUp(auth, 'bob@test.local');
      const before = Date.now();
      await auth.api.requestPasswordReset({ body: { email: 'bob@test.local' } });
      await vi.waitFor(() => expect(mail.sendPasswordResetEmail).toHaveBeenCalledTimes(1));
      const link = mail.sendPasswordResetEmail.mock.calls[0]?.[1] as string;
      const resetToken = tokenOf(link) ?? '';

      const [row] = await testDb.db
        .select()
        .from(verification)
        .where(eq(verification.identifier, `reset-password:${resetToken}`));
      expect(row?.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600_000 - 5_000);
      expect(row?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 3600_000 + 5_000);

      await auth.api.resetPassword({
        body: { token: resetToken, newPassword: 'another long one' },
      });
      const old = await auth.api.getSession({
        headers: new Headers({ authorization: `Bearer ${token}` }),
      });
      expect(old).toBeNull();
      const again = await auth.api.signInEmail({
        body: { email: 'bob@test.local', password: 'another long one' },
      });
      expect(again.token).toEqual(expect.any(String));
    });

    it('confirms account deletion by email, then purges recordings before deleting', async () => {
      const auth = open();
      const { token, user: created } = await signUp(auth, 'bob@test.local');
      const headers = new Headers({ authorization: `Bearer ${token}` });

      await auth.api.deleteUser({ body: {}, headers });
      await vi.waitFor(() => expect(mail.sendDeleteAccountEmail).toHaveBeenCalledTimes(1));
      const [to, link] = mail.sendDeleteAccountEmail.mock.calls[0] as [string, string];
      expect(to).toBe('bob@test.local');
      expect(link.startsWith(`${WEB}/compte/suppression?token=`)).toBe(true);
      // Nothing is deleted until the emailed link is used.
      expect(beforeDelete).not.toHaveBeenCalled();
      expect(await testDb.db.select().from(user).where(eq(user.id, created.id))).toHaveLength(1);

      await auth.api.deleteUserCallback({
        query: { token: tokenOf(link) ?? '' },
        headers,
      });

      expect(beforeDelete).toHaveBeenCalledWith(created.id);
      expect(await testDb.db.select().from(user).where(eq(user.id, created.id))).toEqual([]);
    });

    it('works without a beforeDelete hook', async () => {
      stubEnv({ AUTH_EMAIL_VERIFICATION_ENABLED: 'false' });
      const auth = createAuth(testDb.db, mail as unknown as MailService);
      const { token, user: created } = await signUp(auth, 'dan@test.local');
      const headers = new Headers({ authorization: `Bearer ${token}` });
      await auth.api.deleteUser({ body: {}, headers });
      await vi.waitFor(() => expect(mail.sendDeleteAccountEmail).toHaveBeenCalledTimes(1));
      const link = mail.sendDeleteAccountEmail.mock.calls[0]?.[1] as string;
      await auth.api.deleteUserCallback({ query: { token: tokenOf(link) ?? '' }, headers });
      expect(await testDb.db.select().from(user).where(eq(user.id, created.id))).toEqual([]);
    });
  });
});
