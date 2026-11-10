import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  count,
  eq,
  evaluations,
  examAttempts,
  examRuns,
  inArray,
  providerSettings,
  session,
  transcripts,
  usageLimits,
  user,
  userPreferences,
} from '@parle-tcf/db';
import { type TestApp, createTestApp } from './create-test-app.js';
import {
  CANDIDATE_LINES,
  type TestUser,
  configureProvider,
  ok,
  rpc,
  signUpVerifiedUser,
  startSession,
  waitForEvaluation,
  webLinkInEmail,
} from './helpers.js';

describe('account deletion (Better Auth delete-user, ON DELETE CASCADE)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t?.close());

  /** A user owning one row in every table hanging from `user`. */
  const userWithData = async (label: string) => {
    const u = await signUpVerifiedUser(t, label);
    await configureProvider(t, u.token);
    ok(await rpc(t, '/audio/consent', u.token, { consent: true }));
    await t.db.insert(usageLimits).values({ userId: u.id, dailyMinutes: 90, monthlyCostUsd: '20' });
    const practice = await startSession(t, u.token);
    ok(
      await rpc(t, '/attempts/complete', u.token, {
        attemptId: practice.attemptId,
        lines: CANDIDATE_LINES,
      })
    );
    await waitForEvaluation(t, u.token, practice.attemptId);
    const full = await startSession(t, u.token, { taskType: 'tache1', mode: 'full' });
    return {
      user: u,
      attemptIds: [practice.attemptId, full.attemptId],
      runId: full.runId as string,
    };
  };

  const countsFor = async (userId: string, attemptIds: string[]) => {
    const n = async (q: Promise<{ n: number }[]>) => (await q)[0].n;
    return {
      user: await n(t.db.select({ n: count() }).from(user).where(eq(user.id, userId))),
      sessions: await n(
        t.db.select({ n: count() }).from(session).where(eq(session.userId, userId))
      ),
      settings: await n(
        t.db
          .select({ n: count() })
          .from(providerSettings)
          .where(eq(providerSettings.userId, userId))
      ),
      preferences: await n(
        t.db.select({ n: count() }).from(userPreferences).where(eq(userPreferences.userId, userId))
      ),
      limits: await n(
        t.db.select({ n: count() }).from(usageLimits).where(eq(usageLimits.userId, userId))
      ),
      runs: await n(t.db.select({ n: count() }).from(examRuns).where(eq(examRuns.userId, userId))),
      attempts: await n(
        t.db.select({ n: count() }).from(examAttempts).where(eq(examAttempts.userId, userId))
      ),
      transcripts: await n(
        t.db
          .select({ n: count() })
          .from(transcripts)
          .where(inArray(transcripts.attemptId, attemptIds))
      ),
      evaluations: await n(
        t.db
          .select({ n: count() })
          .from(evaluations)
          .where(inArray(evaluations.attemptId, attemptIds))
      ),
    };
  };

  const requestDeletion = async (u: TestUser) => {
    const res = await t
      .http()
      .post('/api/auth/delete-user')
      .set('Authorization', `Bearer ${u.token}`)
      .send({});
    expect(res.status).toBe(200);
    return webLinkInEmail(u.email, '/compte/suppression');
  };

  it('deletes nothing until the emailed link is confirmed', async () => {
    const { user: u, attemptIds } = await userWithData('pending');
    const before = await countsFor(u.id, attemptIds);
    await requestDeletion(u);
    expect(await countsFor(u.id, attemptIds)).toEqual(before);
    expect((await rpc(t, '/settings/get', u.token)).status).toBe(200);
  });

  it('erases the user and every row hanging from it, and only those', async () => {
    const { user: u, attemptIds } = await userWithData('deleted');
    const bystander = await userWithData('bystander');
    const bystanderBefore = await countsFor(bystander.user.id, bystander.attemptIds);

    const before = await countsFor(u.id, attemptIds);
    expect(before).toEqual({
      user: 1,
      sessions: 1,
      settings: 1,
      preferences: 1,
      limits: 1,
      runs: 1,
      attempts: 2,
      transcripts: CANDIDATE_LINES.length,
      evaluations: 1,
    });

    const link = await requestDeletion(u);
    const confirmed = await t
      .http()
      .get('/api/auth/delete-user/callback')
      .query({ token: link.searchParams.get('token') })
      .set('Authorization', `Bearer ${u.token}`);
    expect(confirmed.status).toBe(200);

    expect(await countsFor(u.id, attemptIds)).toEqual({
      user: 0,
      sessions: 0,
      settings: 0,
      preferences: 0,
      limits: 0,
      runs: 0,
      attempts: 0,
      transcripts: 0,
      evaluations: 0,
    });
    expect((await rpc(t, '/settings/get', u.token)).status).toBe(401);
    expect(await countsFor(bystander.user.id, bystander.attemptIds)).toEqual(bystanderBefore);
  });

  it('refuses the link without the account’s session', async () => {
    const { user: u, attemptIds } = await userWithData('nosession');
    const link = await requestDeletion(u);
    const res = await t
      .http()
      .get('/api/auth/delete-user/callback')
      .query({ token: link.searchParams.get('token') });
    expect(res.status).not.toBe(200);
    expect((await countsFor(u.id, attemptIds)).user).toBe(1);
  });

  it('refuses the link with another account’s session', async () => {
    const { user: u, attemptIds } = await userWithData('victim');
    const other = await signUpVerifiedUser(t, 'other');
    const link = await requestDeletion(u);
    const res = await t
      .http()
      .get('/api/auth/delete-user/callback')
      .query({ token: link.searchParams.get('token') })
      .set('Authorization', `Bearer ${other.token}`);
    expect(res.status).not.toBe(200);
    expect((await countsFor(u.id, attemptIds)).user).toBe(1);
    expect((await t.db.select({ n: count() }).from(user).where(eq(user.id, other.id)))[0].n).toBe(
      1
    );
  });
});
