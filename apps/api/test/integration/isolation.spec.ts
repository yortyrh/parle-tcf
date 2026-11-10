import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { count, eq, examAttempts, examRuns, transcripts } from '@parle-tcf/db';
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

/**
 * Isolation lives in the API (no RLS): another user's resource must look exactly
 * like one that does not exist, and must not change.
 */
describe("cross-user isolation: someone else's resources are NOT_FOUND", () => {
  let t: TestApp;
  let owner: TestUser;
  let intruder: TestUser;
  let done: string;
  let inProgress: string;
  let runId: string;

  const attemptRow = async (id: string) => {
    const [row] = await t.db.select().from(examAttempts).where(eq(examAttempts.id, id));
    return row;
  };
  const lineCount = async (id: string) => {
    const [row] = await t.db
      .select({ n: count() })
      .from(transcripts)
      .where(eq(transcripts.attemptId, id));
    return row.n;
  };

  beforeAll(async () => {
    t = await createTestApp();
    owner = await signUpVerifiedUser(t, 'owner');
    intruder = await signUpVerifiedUser(t, 'intruder');
    await configureProvider(t, owner.token);
    await configureProvider(t, intruder.token);

    ({ attemptId: done } = await startSession(t, owner.token));
    ok(
      await rpc(t, '/attempts/complete', owner.token, { attemptId: done, lines: CANDIDATE_LINES })
    );
    await waitForEvaluation(t, owner.token, done);

    const full = await startSession(t, owner.token, { taskType: 'tache1', mode: 'full' });
    inProgress = full.attemptId;
    runId = full.runId as string;
    ok(
      await rpc(t, '/attempts/checkpoint', owner.token, {
        attemptId: inProgress,
        lines: CANDIDATE_LINES.slice(0, 2),
      })
    );
  });
  afterAll(() => t?.close());

  it('attempts.get', async () => {
    expectError(
      await rpc(t, '/attempts/get', intruder.token, { attemptId: done }),
      404,
      'NOT_FOUND'
    );
    // Same answer as an id that does not exist at all.
    expectError(
      await rpc(t, '/attempts/get', intruder.token, { attemptId: crypto.randomUUID() }),
      404,
      'NOT_FOUND'
    );
  });

  it('attempts.list only returns the caller’s attempts', async () => {
    const mine = ok<{ items: { id: string }[]; total: number }>(
      await rpc(t, '/attempts/list', intruder.token, {})
    );
    expect(mine.items.map((i) => i.id)).not.toContain(done);
    expect(mine.items.map((i) => i.id)).not.toContain(inProgress);
    const theirs = ok<{ total: number }>(await rpc(t, '/attempts/list', owner.token, {}));
    expect(theirs.total).toBe(2);
  });

  it('attempts.delete leaves the attempt in place', async () => {
    expectError(
      await rpc(t, '/attempts/delete', intruder.token, { attemptId: done }),
      404,
      'NOT_FOUND'
    );
    expect(await attemptRow(done)).toBeDefined();
  });

  it('attempts.checkpoint adds no line', async () => {
    const before = await lineCount(inProgress);
    expectError(
      await rpc(t, '/attempts/checkpoint', intruder.token, {
        attemptId: inProgress,
        lines: [{ seq: 50, speaker: 'candidate', text: 'Intrusion' }],
      }),
      404,
      'NOT_FOUND'
    );
    expect(await lineCount(inProgress)).toBe(before);
  });

  it('attempts.complete leaves the attempt in progress', async () => {
    expectError(
      await rpc(t, '/attempts/complete', intruder.token, { attemptId: inProgress, lines: [] }),
      404,
      'NOT_FOUND'
    );
    const row = await attemptRow(inProgress);
    expect(row.status).toBe('in_progress');
    expect(row.finishedAt).toBeNull();
  });

  it('attempts.reevaluate leaves the evaluation as it is', async () => {
    expectError(
      await rpc(t, '/attempts/reevaluate', intruder.token, { attemptId: done }),
      404,
      'NOT_FOUND'
    );
    expect((await attemptRow(done)).evaluationStatus).toBe('done');
  });

  it('runs.get', async () => {
    expectError(await rpc(t, '/runs/get', intruder.token, { runId }), 404, 'NOT_FOUND');
    expect(ok<{ id: string }>(await rpc(t, '/runs/get', owner.token, { runId })).id).toBe(runId);
  });

  it('exam.session.create cannot attach to another user’s run', async () => {
    const before = await t.db
      .select({ n: count() })
      .from(examAttempts)
      .where(eq(examAttempts.userId, intruder.id));
    expectError(
      await rpc(t, '/exam/session/create', intruder.token, {
        taskType: 'tache2',
        mode: 'full',
        runId,
      }),
      404,
      'NOT_FOUND'
    );
    const after = await t.db
      .select({ n: count() })
      .from(examAttempts)
      .where(eq(examAttempts.userId, intruder.id));
    expect(after[0].n).toBe(before[0].n);
    const runAttempts = await t.db.select().from(examAttempts).where(eq(examAttempts.runId, runId));
    expect(runAttempts.every((a) => a.userId === owner.id)).toBe(true);
  });

  it('exam.session.token (refresh) does not restart the clock', async () => {
    const before = await attemptRow(inProgress);
    expectError(
      await rpc(t, '/exam/session/token', intruder.token, { attemptId: inProgress }),
      404,
      'NOT_FOUND'
    );
    expect((await attemptRow(inProgress)).startedAt).toEqual(before.startedAt);
  });

  it('audio.downloadUrl', async () => {
    expectError(
      await rpc(t, '/audio/download-url', intruder.token, { attemptId: done }),
      404,
      'NOT_FOUND'
    );
    expect(ok(await rpc(t, '/audio/download-url', owner.token, { attemptId: done }))).toEqual({
      url: null,
    });
  });

  it('audio consent is per user', async () => {
    ok(await rpc(t, '/audio/consent', intruder.token, { consent: true }));
    expect(ok(await rpc(t, '/audio/status', owner.token))).toEqual({
      available: false,
      consent: false,
    });
    expect(ok(await rpc(t, '/audio/status', intruder.token))).toEqual({
      available: false,
      consent: true,
    });
  });

  it('settings are per user and never expose the key', async () => {
    ok(await rpc(t, '/settings/delete', intruder.token));
    const theirs = ok(await rpc(t, '/settings/get', owner.token));
    expect(theirs.configured).toBe(true);
    expect(JSON.stringify(theirs)).not.toMatch(/sk-integration/);
    expect(ok(await rpc(t, '/settings/get', intruder.token)).configured).toBe(false);
  });

  it('the owner still sees everything intact', async () => {
    const detail = ok<{ transcript: unknown[]; evaluationStatus: string }>(
      await rpc(t, '/attempts/get', owner.token, { attemptId: done })
    );
    expect(detail.transcript).toHaveLength(CANDIDATE_LINES.length);
    expect(detail.evaluationStatus).toBe('done');
    const [run] = await t.db.select().from(examRuns).where(eq(examRuns.id, runId));
    expect(run.userId).toBe(owner.id);
  });
});
