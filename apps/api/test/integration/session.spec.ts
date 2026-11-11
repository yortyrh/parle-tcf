import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  and,
  count,
  eq,
  examAttempts,
  exercises,
  providerSettings,
  usageLimits,
} from '@parle-tcf/db';
import { type TestApp, createTestApp } from './create-test-app.js';
import {
  GEMINI_KEY,
  OPENAI_KEY,
  type StartedSession,
  type TestUser,
  configureProvider,
  expectError,
  ok,
  rpc,
  signUpVerifiedUser,
  startSession,
} from './helpers.js';

interface SessionBody extends StartedSession {
  provider: 'openai' | 'gemini';
  sessionId: string;
  exerciseData: { title: string; exerciseId?: string; taskType?: string };
  orderedExerciseIds?: string[];
  agentConfig: { instructions: string; voice: string; model: string };
}

describe('exam.session.create and exam.session.token', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t?.close());

  const attemptsOf = async (userId: string) => {
    const [row] = await t.db
      .select({ n: count() })
      .from(examAttempts)
      .where(eq(examAttempts.userId, userId));
    return row.n;
  };
  const attemptRow = async (id: string) => {
    const [row] = await t.db.select().from(examAttempts).where(eq(examAttempts.id, id));
    return row;
  };
  const create = (u: TestUser, input: Record<string, unknown>) =>
    rpc(t, '/exam/session/create', u.token, input);

  /** A completed attempt from today that counts toward the usage. */
  const usedToday = (userId: string, minutes: string, costUsd: string | null = null) =>
    t.db.insert(examAttempts).values({
      userId,
      mode: 'practice',
      task: 1,
      provider: 'openai',
      model: 'gpt-realtime-mini',
      status: 'completed',
      realtimeMinutes: minutes,
      estimatedCostUsd: costUsd,
      finishedAt: new Date(),
    });

  describe('provider configuration (BYOK)', () => {
    it('refuses with PROVIDER_NOT_CONFIGURED (412) and creates nothing without a key', async () => {
      const u = await signUpVerifiedUser(t, 'nokey');
      expectError(await create(u, { taskType: 'tache1' }), 412, 'PROVIDER_NOT_CONFIGURED');
      expect(await attemptsOf(u.id)).toBe(0);
    });

    it('decrypts the stored OpenAI key to mint the client secret', async () => {
      const u = await signUpVerifiedUser(t, 'openai');
      await configureProvider(t, u.token, 'openai');
      const [stored] = await t.db
        .select()
        .from(providerSettings)
        .where(eq(providerSettings.userId, u.id));
      expect(stored.apiKeyCiphertext).not.toContain(OPENAI_KEY);
      expect(stored.last4).toBe(OPENAI_KEY.slice(-4));

      const body = ok<SessionBody>(await create(u, { taskType: 'tache1' }));
      // The fake provider echoes the length of the key it received.
      expect(body.clientSecret).toBe(`fake-client-secret:openai:${OPENAI_KEY.length}`);
      expect(body.provider).toBe('openai');
      expect(body.agentConfig.model).toBe('gpt-realtime-2.1-mini');
      expect(body.agentConfig.voice).toBe('marin');

      const row = await attemptRow(body.attemptId);
      expect(row).toMatchObject({
        userId: u.id,
        status: 'in_progress',
        provider: 'openai',
        model: 'gpt-realtime-2.1-mini',
        task: 1,
        mode: 'practice',
        runId: null,
        exerciseId: 't1-entretien',
      });
    });

    it('uses the Gemini key and the Gemini defaults', async () => {
      const u = await signUpVerifiedUser(t, 'gemini');
      await configureProvider(t, u.token, 'gemini');
      const body = ok<SessionBody>(await create(u, { taskType: 'tache1' }));
      expect(body.clientSecret).toBe(`fake-client-secret:gemini:${GEMINI_KEY.length}`);
      expect(body.provider).toBe('gemini');
      expect(body.agentConfig.voice).toBe('Puck');
      expect(body.agentConfig.model).toBe('gemini-3.8-live');
      expect(await attemptRow(body.attemptId)).toMatchObject({
        provider: 'gemini',
        model: 'gemini-3.8-live',
      });
    });

    it('keeps the user’s own model and voice', async () => {
      const u = await signUpVerifiedUser(t, 'custom');
      ok(
        await rpc(t, '/settings/upsert', u.token, {
          apiKey: OPENAI_KEY,
          realtimeModel: 'gpt-realtime',
          voice: 'verse',
        })
      );
      const body = ok<SessionBody>(await create(u, { taskType: 'tache1' }));
      expect(body.agentConfig.model).toBe('gpt-realtime');
      expect(body.agentConfig.voice).toBe('verse');
    });
  });

  describe('exercises', () => {
    let u: TestUser;
    let tache2Id: string;
    let tache3Id: string;

    beforeAll(async () => {
      u = await signUpVerifiedUser(t, 'exercise');
      await configureProvider(t, u.token);
      const [t2] = await t.db.select().from(exercises).where(eq(exercises.task, 2)).limit(1);
      const [t3] = await t.db.select().from(exercises).where(eq(exercises.task, 3)).limit(1);
      tache2Id = t2.id;
      tache3Id = t3.id;
    });

    it('serves the requested subject with the ordered ids of the task', async () => {
      const body = ok<SessionBody>(await create(u, { taskType: 'tache2', exerciseId: tache2Id }));
      expect(body.exerciseData.exerciseId).toBe(tache2Id);
      expect(body.orderedExerciseIds).toContain(tache2Id);
      expect(body.orderedExerciseIds).not.toContain(tache3Id);
      expect(body.agentConfig.instructions).toContain('EXERCICE À UTILISER');
      expect((await attemptRow(body.attemptId)).exerciseId).toBe(tache2Id);
    });

    it('picks a subject of the task when none is requested', async () => {
      const body = ok<SessionBody>(await create(u, { taskType: 'tache3' }));
      const [row] = await t.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, body.exerciseData.exerciseId as string));
      expect(row.task).toBe(3);
    });

    it('gives tâche 1 no subject navigation', async () => {
      const body = ok<SessionBody>(await create(u, { taskType: 'tache1' }));
      expect(body.orderedExerciseIds).toEqual([]);
    });

    it.each([
      ['an unknown id', () => 'does-not-exist'],
      ['a subject of another task', () => tache3Id],
    ])('answers NOT_FOUND for %s and creates nothing', async (_label, id) => {
      const before = await attemptsOf(u.id);
      expectError(await create(u, { taskType: 'tache2', exerciseId: id() }), 404, 'NOT_FOUND');
      expect(await attemptsOf(u.id)).toBe(before);
    });

    it('rejects an unknown task type', async () => {
      expectError(await create(u, { taskType: 'tache4' }), 400, 'BAD_REQUEST');
    });
  });

  describe('full exam runs', () => {
    it('creates a run for the first task and reuses it for the next ones', async () => {
      const u = await signUpVerifiedUser(t, 'run');
      await configureProvider(t, u.token);
      const first = ok<SessionBody>(await create(u, { taskType: 'tache1', mode: 'full' }));
      expect(first.runId).toEqual(expect.any(String));
      const second = ok<SessionBody>(
        await create(u, { taskType: 'tache2', mode: 'full', runId: first.runId })
      );
      expect(second.runId).toBe(first.runId);
      const run = ok<{ attempts: { task: number }[] }>(
        await rpc(t, '/runs/get', u.token, { runId: first.runId })
      );
      expect(run.attempts.map((a) => a.task)).toEqual([1, 2]);
    });

    it('ignores a run id in practice mode', async () => {
      const u = await signUpVerifiedUser(t, 'practice');
      await configureProvider(t, u.token);
      const full = ok<SessionBody>(await create(u, { taskType: 'tache1', mode: 'full' }));
      const practice = ok<SessionBody>(
        await create(u, { taskType: 'tache2', mode: 'practice', runId: full.runId })
      );
      expect(practice.runId).toBeNull();
    });
  });

  describe('usage limits', () => {
    it('refuses with LIMIT_REACHED (429) once the daily minutes are used', async () => {
      const u = await signUpVerifiedUser(t, 'daily');
      await configureProvider(t, u.token);
      await t.db
        .insert(usageLimits)
        .values({ userId: u.id, dailyMinutes: 2, monthlyCostUsd: '10' });
      await usedToday(u.id, '1.99');
      ok(await create(u, { taskType: 'tache1' }));

      await usedToday(u.id, '0.01');
      const before = await attemptsOf(u.id);
      expectError(await create(u, { taskType: 'tache1' }), 429, 'LIMIT_REACHED');
      expect(await attemptsOf(u.id)).toBe(before);
    });

    it('refuses with LIMIT_REACHED (429) once the monthly cost is reached', async () => {
      const u = await signUpVerifiedUser(t, 'monthly');
      await configureProvider(t, u.token);
      await t.db
        .insert(usageLimits)
        .values({ userId: u.id, dailyMinutes: 600, monthlyCostUsd: '0.50' });
      await usedToday(u.id, '0', '0.4999');
      ok(await create(u, { taskType: 'tache1' }));
      await usedToday(u.id, '0', '0.0001');
      expectError(await create(u, { taskType: 'tache1' }), 429, 'LIMIT_REACHED');
    });

    it('only counts the caller’s own usage', async () => {
      const heavy = await signUpVerifiedUser(t, 'heavy');
      const light = await signUpVerifiedUser(t, 'light');
      await configureProvider(t, light.token);
      await usedToday(heavy.id, '600.00');
      ok(await create(light, { taskType: 'tache1' }));
    });
  });

  describe('exam.session.token (refresh before connecting)', () => {
    let u: TestUser;

    beforeAll(async () => {
      u = await signUpVerifiedUser(t, 'refresh');
      await configureProvider(t, u.token);
    });

    const refresh = (attemptId: string) => rpc(t, '/exam/session/token', u.token, { attemptId });

    it('mints a fresh secret and starts the attempt clock', async () => {
      const { attemptId } = await startSession(t, u.token);
      await t.db
        .update(examAttempts)
        .set({ startedAt: new Date(Date.now() - 120_000) })
        .where(eq(examAttempts.id, attemptId));

      const body = ok<{ clientSecret: string }>(await refresh(attemptId));
      expect(body.clientSecret).toBe(`fake-client-secret:openai:${OPENAI_KEY.length}`);
      const row = await attemptRow(attemptId);
      expect(Date.now() - row.startedAt.getTime()).toBeLessThan(30_000);
      expect(row.lastActivityAt.getTime()).toBe(row.startedAt.getTime());
    });

    it('answers CONFLICT for a finished attempt', async () => {
      const { attemptId } = await startSession(t, u.token);
      ok(await rpc(t, '/attempts/complete', u.token, { attemptId, lines: [] }));
      expectError(await refresh(attemptId), 409, 'CONFLICT');
    });

    it('answers CONFLICT when the provider changed since the task started', async () => {
      const other = await signUpVerifiedUser(t, 'switch');
      await configureProvider(t, other.token, 'openai');
      const { attemptId } = await startSession(t, other.token);
      await configureProvider(t, other.token, 'gemini');
      expectError(await rpc(t, '/exam/session/token', other.token, { attemptId }), 409, 'CONFLICT');
    });

    it('answers LIMIT_REACHED when the limit was reached meanwhile', async () => {
      const capped = await signUpVerifiedUser(t, 'capped');
      await configureProvider(t, capped.token);
      const { attemptId } = await startSession(t, capped.token);
      await t.db
        .insert(usageLimits)
        .values({ userId: capped.id, dailyMinutes: 1, monthlyCostUsd: '10' });
      await usedToday(capped.id, '5.00');
      expectError(
        await rpc(t, '/exam/session/token', capped.token, { attemptId }),
        429,
        'LIMIT_REACHED'
      );
    });

    it('answers PROVIDER_NOT_CONFIGURED once the key was removed', async () => {
      const removed = await signUpVerifiedUser(t, 'removed');
      await configureProvider(t, removed.token);
      const { attemptId } = await startSession(t, removed.token);
      ok(await rpc(t, '/settings/delete', removed.token));
      expectError(
        await rpc(t, '/exam/session/token', removed.token, { attemptId }),
        412,
        'PROVIDER_NOT_CONFIGURED'
      );
    });

    it('answers NOT_FOUND for an unknown attempt', async () => {
      expectError(await refresh(crypto.randomUUID()), 404, 'NOT_FOUND');
      const [row] = await t.db
        .select({ n: count() })
        .from(examAttempts)
        .where(and(eq(examAttempts.userId, u.id), eq(examAttempts.status, 'in_progress')));
      expect(row.n).toBeGreaterThan(0);
    });
  });
});
