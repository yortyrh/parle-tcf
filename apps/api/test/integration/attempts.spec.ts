import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asc,
  count,
  eq,
  evaluations,
  examAttempts,
  examRuns,
  transcripts,
  usageLimits,
} from '@parle-tcf/db';
import { type TestApp, createTestApp } from './create-test-app.js';
import {
  CANDIDATE_LINES,
  type TestUser,
  configureProvider,
  expectError,
  ok,
  rpc,
  signUpVerifiedUser,
  startSession,
  waitForEvaluation,
} from './helpers.js';

interface Detail {
  status: string;
  evaluationStatus: string;
  globalLevel: string | null;
  durationS: number | null;
  estimatedCostUsd: number | null;
  evaluation: {
    globalLevel: string;
    criteria: Record<string, { level: string }>;
    summary: string;
    correctorModel: string;
  } | null;
  transcript: { seq: number; speaker: string; text: string; correctedText: string | null }[];
}

describe('attempts', () => {
  let t: TestApp;
  let u: TestUser;

  beforeAll(async () => {
    t = await createTestApp();
    u = await signUpVerifiedUser(t, 'attempts');
    await configureProvider(t, u.token);
  });
  afterAll(() => t?.close());

  const attemptRow = async (id: string) => {
    const [row] = await t.db.select().from(examAttempts).where(eq(examAttempts.id, id));
    return row;
  };
  const linesOf = (id: string) =>
    t.db
      .select()
      .from(transcripts)
      .where(eq(transcripts.attemptId, id))
      .orderBy(asc(transcripts.seq));
  const call = (route: string, input: unknown = {}) => rpc(t, route, u.token, input);

  describe('checkpoint', () => {
    it('is idempotent by seq: replays and overlapping batches keep one line per seq', async () => {
      const { attemptId } = await startSession(t, u.token);
      const batch = CANDIDATE_LINES.slice(0, 2);

      expect(ok(await call('/attempts/checkpoint', { attemptId, lines: batch }))).toEqual({
        ok: true,
        limitReached: false,
      });
      ok(await call('/attempts/checkpoint', { attemptId, lines: batch }));
      ok(
        await call('/attempts/checkpoint', {
          attemptId,
          lines: [
            { seq: 1, speaker: 'candidate', text: "Je m'appelle Alex, j'habite à Lyon." },
            CANDIDATE_LINES[2],
          ],
        })
      );

      const lines = await linesOf(attemptId);
      expect(lines.map((l) => l.seq)).toEqual([0, 1, 2]);
      expect(lines[1].text).toBe("Je m'appelle Alex, j'habite à Lyon.");
    });

    it('records a sign of life', async () => {
      const { attemptId } = await startSession(t, u.token);
      const old = new Date(Date.now() - 10 * 60_000);
      await t.db
        .update(examAttempts)
        .set({ startedAt: old, lastActivityAt: old })
        .where(eq(examAttempts.id, attemptId));
      ok(await call('/attempts/checkpoint', { attemptId, lines: [] }));
      expect((await attemptRow(attemptId)).lastActivityAt.getTime()).toBeGreaterThan(old.getTime());
    });

    it('ignores lines sent after the attempt was completed', async () => {
      const { attemptId } = await startSession(t, u.token);
      ok(await call('/attempts/complete', { attemptId, lines: CANDIDATE_LINES.slice(0, 2) }));
      ok(
        await call('/attempts/checkpoint', {
          attemptId,
          lines: [{ seq: 9, speaker: 'candidate', text: 'Trop tard' }],
        })
      );
      expect((await linesOf(attemptId)).map((l) => l.seq)).toEqual([0, 1]);
    });

    it('reports limitReached once the daily limit is used up', async () => {
      const capped = await signUpVerifiedUser(t, 'capped');
      await configureProvider(t, capped.token);
      const { attemptId } = await startSession(t, capped.token);
      await t.db
        .insert(usageLimits)
        .values({ userId: capped.id, dailyMinutes: 1, monthlyCostUsd: '10' });
      // The live session itself counts up to its last sign of life.
      await t.db
        .update(examAttempts)
        .set({ startedAt: new Date(Date.now() - 2 * 60_000) })
        .where(eq(examAttempts.id, attemptId));
      expect(
        ok(await rpc(t, '/attempts/checkpoint', capped.token, { attemptId, lines: [] }))
      ).toEqual({ ok: true, limitReached: true });
    });

    it('validates the lines', async () => {
      const { attemptId } = await startSession(t, u.token);
      expectError(
        await call('/attempts/checkpoint', {
          attemptId,
          lines: [{ seq: -1, speaker: 'candidate', text: 'x' }],
        }),
        400,
        'BAD_REQUEST'
      );
      expectError(
        await call('/attempts/checkpoint', {
          attemptId,
          lines: [{ seq: 0, speaker: 'robot', text: 'x' }],
        }),
        400,
        'BAD_REQUEST'
      );
    });
  });

  describe('complete and evaluation', () => {
    it('completes once, computes duration and cost on the server, then grades B1', async () => {
      const { attemptId } = await startSession(t, u.token);
      await t.db
        .update(examAttempts)
        .set({ startedAt: new Date(Date.now() - 90_000) })
        .where(eq(examAttempts.id, attemptId));

      ok(
        await call('/attempts/complete', {
          attemptId,
          lines: CANDIDATE_LINES,
          usage: { inputTokens: 1000, outputTokens: 500 },
          durationS: 9999,
        })
      );
      const detail = (await waitForEvaluation(t, u.token, attemptId)) as unknown as Detail;

      expect(detail.status).toBe('completed');
      expect(detail.durationS).toBeGreaterThanOrEqual(89);
      expect(detail.durationS).toBeLessThan(200);
      // gpt-realtime-2.1-mini: 1000 × 10 $/M + 500 × 20 $/M = 0.02 $ (+ a negligible correction).
      expect(detail.estimatedCostUsd).toBeCloseTo(0.02, 3);

      expect(detail.evaluationStatus).toBe('done');
      expect(detail.globalLevel).toBe('B1');
      expect(detail.evaluation).toMatchObject({
        globalLevel: 'B1',
        summary: 'Évaluation simulée (mode test).',
        correctorModel: 'gpt-4o-mini',
      });
      expect(Object.values(detail.evaluation?.criteria ?? {}).map((c) => c.level)).toEqual([
        'B1',
        'B1',
        'B1',
        'B1',
        'B1',
      ]);
      // The fake corrector echoes candidate lines; examiner lines get no correction.
      for (const line of detail.transcript) {
        expect(line.correctedText).toBe(line.speaker === 'candidate' ? line.text : null);
      }
    });

    it('is idempotent: a second complete changes nothing and grades once', async () => {
      const { attemptId } = await startSession(t, u.token);
      ok(await call('/attempts/complete', { attemptId, lines: CANDIDATE_LINES }));
      await waitForEvaluation(t, u.token, attemptId);
      const first = await attemptRow(attemptId);
      const [evaluation] = await t.db
        .select()
        .from(evaluations)
        .where(eq(evaluations.attemptId, attemptId));

      expect(
        ok(
          await call('/attempts/complete', {
            attemptId,
            lines: [{ seq: 7, speaker: 'candidate', text: 'Une ligne de plus' }],
            usage: { inputTokens: 999_999, outputTokens: 999_999 },
          })
        )
      ).toEqual({ ok: true });

      const second = await attemptRow(attemptId);
      expect(second.finishedAt).toEqual(first.finishedAt);
      expect(second.estimatedCostUsd).toBe(first.estimatedCostUsd);
      expect(second.evaluationStatus).toBe('done');
      expect((await linesOf(attemptId)).map((l) => l.seq)).toEqual([0, 1, 2, 3]);
      const after = await t.db
        .select()
        .from(evaluations)
        .where(eq(evaluations.attemptId, attemptId));
      expect(after).toHaveLength(1);
      expect(after[0].createdAt).toEqual(evaluation.createdAt);
    });

    it('fails the evaluation when the candidate never spoke', async () => {
      const { attemptId } = await startSession(t, u.token);
      ok(
        await call('/attempts/complete', {
          attemptId,
          lines: [{ seq: 0, speaker: 'examiner', text: 'Bonjour ?' }],
        })
      );
      const detail = (await waitForEvaluation(t, u.token, attemptId)) as unknown as Detail;
      expect(detail.evaluationStatus).toBe('failed');
      expect(detail.evaluation).toBeNull();
    });

    it('reevaluate re-runs a failed evaluation once the transcript allows it', async () => {
      const { attemptId } = await startSession(t, u.token);
      ok(await call('/attempts/complete', { attemptId, lines: [] }));
      expect(
        ((await waitForEvaluation(t, u.token, attemptId)) as unknown as Detail).evaluationStatus
      ).toBe('failed');

      await t.db.insert(transcripts).values({ attemptId, ...CANDIDATE_LINES[1] });
      expect(ok(await call('/attempts/reevaluate', { attemptId }))).toEqual({ ok: true });
      const detail = (await waitForEvaluation(t, u.token, attemptId)) as unknown as Detail;
      expect(detail.evaluationStatus).toBe('done');
      expect(detail.globalLevel).toBe('B1');
    });

    it('reevaluate answers CONFLICT while an evaluation is running', async () => {
      const { attemptId } = await startSession(t, u.token);
      ok(await call('/attempts/complete', { attemptId, lines: CANDIDATE_LINES }));
      await waitForEvaluation(t, u.token, attemptId);
      await t.db
        .update(examAttempts)
        .set({ evaluationStatus: 'running' })
        .where(eq(examAttempts.id, attemptId));
      expectError(await call('/attempts/reevaluate', { attemptId }), 409, 'CONFLICT');
      expect((await attemptRow(attemptId)).evaluationStatus).toBe('running');
    });

    it('reevaluate answers NOT_FOUND for an attempt still in progress', async () => {
      const { attemptId } = await startSession(t, u.token);
      expectError(await call('/attempts/reevaluate', { attemptId }), 404, 'NOT_FOUND');
      expect((await attemptRow(attemptId)).evaluationStatus).toBe('pending');
    });

    it('sets the overall level of a full run once its three tasks are graded', async () => {
      const runner = await signUpVerifiedUser(t, 'runner');
      await configureProvider(t, runner.token);
      let runId: string | null = null;
      for (const taskType of ['tache1', 'tache2', 'tache3']) {
        const s = await startSession(t, runner.token, {
          taskType,
          mode: 'full',
          ...(runId ? { runId } : {}),
        });
        runId = s.runId;
        ok(
          await rpc(t, '/attempts/complete', runner.token, {
            attemptId: s.attemptId,
            lines: CANDIDATE_LINES,
          })
        );
        await waitForEvaluation(t, runner.token, s.attemptId);
      }
      const run = ok<{ globalLevel: string | null; finishedAt: string | null }>(
        await rpc(t, '/runs/get', runner.token, { runId })
      );
      expect(run.globalLevel).toBe('B1');
      expect(run.finishedAt).not.toBeNull();
    });

    it('leaves a run without level while a task is missing', async () => {
      const runner = await signUpVerifiedUser(t, 'partial');
      await configureProvider(t, runner.token);
      const s = await startSession(t, runner.token, { taskType: 'tache1', mode: 'full' });
      ok(
        await rpc(t, '/attempts/complete', runner.token, {
          attemptId: s.attemptId,
          lines: CANDIDATE_LINES,
        })
      );
      await waitForEvaluation(t, runner.token, s.attemptId);
      const [run] = await t.db
        .select()
        .from(examRuns)
        .where(eq(examRuns.id, s.runId as string));
      expect(run.globalLevel).toBeNull();
      expect(run.finishedAt).toBeNull();
    });
  });

  describe('list, get and delete', () => {
    let lister: TestUser;

    beforeAll(async () => {
      lister = await signUpVerifiedUser(t, 'lister');
      await configureProvider(t, lister.token);
      await startSession(t, lister.token, { taskType: 'tache1' });
      await startSession(t, lister.token, { taskType: 'tache2' });
      await startSession(t, lister.token, { taskType: 'tache2', mode: 'full' });
    });

    const list = async (input: unknown) =>
      ok<{ items: { task: number; mode: string; startedAt: string }[]; total: number }>(
        await rpc(t, '/attempts/list', lister.token, input)
      );

    it('lists newest first and filters by task and mode', async () => {
      const all = await list({});
      expect(all.total).toBe(3);
      const starts = all.items.map((i) => i.startedAt);
      expect([...starts].sort().reverse()).toEqual(starts);

      const task2 = await list({ task: 2 });
      expect(task2.total).toBe(2);
      expect(task2.items.every((i) => i.task === 2)).toBe(true);

      const full = await list({ mode: 'full' });
      expect(full.total).toBe(1);
      expect(full.items[0]).toMatchObject({ task: 2, mode: 'full' });
    });

    it('paginates with the total counted before the page', async () => {
      const page = await list({ limit: 1, offset: 1 });
      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(3);
      expectError(await rpc(t, '/attempts/list', lister.token, { limit: 101 }), 400, 'BAD_REQUEST');
    });

    it('deletes an attempt with its transcript', async () => {
      const { attemptId } = await startSession(t, u.token);
      ok(await call('/attempts/checkpoint', { attemptId, lines: CANDIDATE_LINES }));
      expect(ok(await call('/attempts/delete', { attemptId }))).toEqual({ ok: true });
      expect(await attemptRow(attemptId)).toBeUndefined();
      const [lines] = await t.db
        .select({ n: count() })
        .from(transcripts)
        .where(eq(transcripts.attemptId, attemptId));
      expect(lines.n).toBe(0);
      expectError(await call('/attempts/get', { attemptId }), 404, 'NOT_FOUND');
      expectError(await call('/attempts/delete', { attemptId }), 404, 'NOT_FOUND');
    });
  });

  it('usage.get reports today’s minutes against the limits', async () => {
    const counted = await signUpVerifiedUser(t, 'usage');
    await t.db
      .insert(usageLimits)
      .values({ userId: counted.id, dailyMinutes: 45, monthlyCostUsd: '7.50' });
    await t.db.insert(examAttempts).values({
      userId: counted.id,
      mode: 'practice',
      task: 1,
      provider: 'openai',
      model: 'gpt-realtime-mini',
      status: 'completed',
      realtimeMinutes: '3.50',
      estimatedCostUsd: '0.1200',
    });
    expect(ok(await rpc(t, '/usage/get', counted.token))).toEqual({
      todayMinutes: 3.5,
      dailyMinutesLimit: 45,
      monthCostUsd: 0.12,
      monthlyCostLimitUsd: 7.5,
    });
    const fresh = await signUpVerifiedUser(t, 'fresh');
    expect(ok(await rpc(t, '/usage/get', fresh.token))).toEqual({
      todayMinutes: 0,
      dailyMinutesLimit: 60,
      monthCostUsd: 0,
      monthlyCostLimitUsd: 10,
    });
  });
});
