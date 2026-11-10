import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { examAttempts, examRuns, eq } from "@parle-tcf/db";
import { AttemptsService } from "../attempts/attempts.service.js";
import { ProviderSettingsService } from "../settings/provider-settings.service.js";
import { fakeVoiceProvider, registryOf, testCipher } from "../test-helpers.js";
import {
  EvaluationService,
  locateErrors,
  STALE_RUNNING_MS,
} from "./evaluation.service.js";

const KEY = "sk-test-0123456789abcdef";

const goodOutput = {
  globalLevel: "B1",
  criteria: Object.fromEntries(
    ["adequation", "coherence", "vocabulaire", "grammaire", "aisance"].map(
      (c) => [c, { level: "B1", comment: "Correct." }],
    ),
  ),
  summary: "Bon niveau B1.",
  utterances: [
    {
      seq: 1,
      corrected: "Je suis allé au marché.",
      errors: [
        {
          excerpt: "suis allé à le",
          type: "grammaire",
          explanation: "Contraction.",
        },
        {
          excerpt: "introuvable",
          type: "lexique",
          explanation: "Absent du texte.",
        },
      ],
    },
  ],
};

function result(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 50, text: 50, reasoning: 0 },
    },
    warnings: [],
  };
}

describe("locateErrors", () => {
  it("keeps verbatim excerpts and drops paraphrased ones", () => {
    const out = locateErrors("Je suis allé à le marché.", [
      { excerpt: "suis allé à le", type: "grammaire", explanation: "x" },
      { excerpt: "absent", type: "lexique", explanation: "y" },
    ]);
    expect(out).toEqual([
      { start: 3, end: 17, type: "grammaire", explanation: "x" },
    ]);
  });
});

describe("EvaluationService", () => {
  let testDb: TestDb;
  let attempts: AttemptsService;
  let settings: ProviderSettingsService;
  let userId: string;
  let attemptId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
    userId = await testDb.createUser();
    attempts = new AttemptsService(testDb.db);
    settings = new ProviderSettingsService(
      testDb.db,
      testCipher(),
      registryOf(fakeVoiceProvider()),
    );
    await settings.upsert(userId, { apiKey: KEY });
    const a = await attempts.create({
      userId,
      mode: "practice",
      runId: null,
      exerciseId: null,
      task: 2,
      model: "gpt-realtime-mini",
    });
    attemptId = a.id;
    await attempts.complete(userId, {
      attemptId,
      lines: [
        { seq: 0, speaker: "examiner", text: "Bonjour" },
        { seq: 1, speaker: "candidate", text: "Je suis allé à le marché." },
      ],
      usage: { inputTokens: 1000, outputTokens: 500 },
    });
  });

  const serviceWith = (model: MockLanguageModelV4) =>
    new EvaluationService(testDb.db, settings, () => model);

  it("stores the evaluation, the corrections and the cost", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: result(JSON.stringify(goodOutput)),
    });
    await serviceWith(model).evaluate(userId, attemptId);

    const detail = await attempts.get(userId, attemptId);
    expect(detail.evaluationStatus).toBe("done");
    expect(detail.evaluation?.globalLevel).toBe("B1");
    expect(detail.evaluation?.summary).toBe("Bon niveau B1.");
    const line = detail.transcript.find((l) => l.seq === 1);
    expect(line?.correctedText).toBe("Je suis allé au marché.");
    expect(line?.errors).toHaveLength(1);
    expect(detail.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("retries on an invalid output, then succeeds", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [result("pas du json"), result(JSON.stringify(goodOutput))],
    });
    await serviceWith(model).evaluate(userId, attemptId);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect((await attempts.get(userId, attemptId)).evaluationStatus).toBe(
      "done",
    );
  });

  it("marks the evaluation failed after 3 bad outputs, keeping the transcript", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: result("{}"),
    });
    await serviceWith(model).evaluate(userId, attemptId);
    expect(model.doGenerateCalls).toHaveLength(3);
    const detail = await attempts.get(userId, attemptId);
    expect(detail.evaluationStatus).toBe("failed");
    expect(detail.evaluation).toBeNull();
    expect(detail.transcript).toHaveLength(2);
  });

  it("never evaluates someone else's attempt", async () => {
    const other = await testDb.createUser("other@test.local");
    const model = new MockLanguageModelV4({
      doGenerate: result(JSON.stringify(goodOutput)),
    });
    await serviceWith(model).evaluate(other, attemptId);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await serviceWith(model).requeue(other, attemptId)).toBe(
      "not_found",
    );
    expect((await attempts.get(userId, attemptId)).evaluationStatus).toBe(
      "pending",
    );
  });

  it("marks stale running evaluations as failed", async () => {
    await testDb.db
      .update(examAttempts)
      .set({
        evaluationStatus: "running",
        finishedAt: new Date(Date.now() - 10 * 60_000),
      })
      .where(eq(examAttempts.id, attemptId));
    await serviceWith(new MockLanguageModelV4()).failStale();
    expect((await attempts.get(userId, attemptId)).evaluationStatus).toBe(
      "failed",
    );
  });

  it("sets the run level once the three tasks are graded", async () => {
    const [run] = await testDb.db
      .insert(examRuns)
      .values({ userId, mode: "full" })
      .returning();
    const svc = serviceWith(
      new MockLanguageModelV4({
        doGenerate: result(JSON.stringify(goodOutput)),
      }),
    );
    for (const task of [1, 2, 3]) {
      const a = await attempts.create({
        userId,
        mode: "full",
        runId: run!.id,
        exerciseId: null,
        task,
        model: "gpt-realtime-mini",
      });
      await attempts.complete(userId, {
        attemptId: a.id,
        lines: [{ seq: 0, speaker: "candidate", text: "Bonjour madame." }],
      });
      await svc.evaluate(userId, a.id);
    }
    const [row] = await testDb.db
      .select()
      .from(examRuns)
      .where(eq(examRuns.id, run!.id));
    expect(row?.globalLevel).toBe("B1");
  });
  const goodModel = () =>
    new MockLanguageModelV4({
      doGenerate: result(JSON.stringify(goodOutput)),
    });

  const setRow = (
    id: string,
    values: Partial<typeof examAttempts.$inferInsert>,
  ) =>
    testDb.db.update(examAttempts).set(values).where(eq(examAttempts.id, id));

  const rowOf = async (id: string) => {
    const [row] = await testDb.db
      .select()
      .from(examAttempts)
      .where(eq(examAttempts.id, id));
    return row!;
  };

  describe("atomic claim", () => {
    it("evaluates only once when two evaluations race", async () => {
      const model = goodModel();
      const svc = serviceWith(model);
      await Promise.all([
        svc.evaluate(userId, attemptId),
        svc.evaluate(userId, attemptId),
      ]);
      expect(model.doGenerateCalls).toHaveLength(1);
      expect((await rowOf(attemptId)).evaluationStatus).toBe("done");
    });

    it("does not evaluate again once done", async () => {
      const model = goodModel();
      const svc = serviceWith(model);
      await svc.evaluate(userId, attemptId);
      await svc.evaluate(userId, attemptId);
      expect(model.doGenerateCalls).toHaveLength(1);
      expect((await rowOf(attemptId)).evaluationStatus).toBe("done");
    });

    it.each(["running", "failed", "done"] as const)(
      "leaves an attempt whose evaluation is %s alone",
      async (status) => {
        const startedAt = new Date(Date.now() - 60_000);
        await setRow(attemptId, {
          evaluationStatus: status,
          evaluationStartedAt: startedAt,
        });
        const model = goodModel();
        await serviceWith(model).evaluate(userId, attemptId);
        expect(model.doGenerateCalls).toHaveLength(0);
        const row = await rowOf(attemptId);
        expect(row.evaluationStatus).toBe(status);
        expect(row.evaluationStartedAt?.getTime()).toBe(startedAt.getTime());
      },
    );

    it("does not claim an attempt that is not completed", async () => {
      const a = await attempts.create({
        userId,
        mode: "practice",
        runId: null,
        exerciseId: null,
        task: 2,
        model: "gpt-realtime-mini",
      });
      const model = goodModel();
      await serviceWith(model).evaluate(userId, a.id);
      expect(model.doGenerateCalls).toHaveLength(0);
      const row = await rowOf(a.id);
      expect(row.evaluationStatus).toBe("pending");
      expect(row.evaluationStartedAt).toBeNull();
    });

    it("does not claim someone else's attempt", async () => {
      const other = await testDb.createUser("intruder@test.local");
      await serviceWith(goodModel()).evaluate(other, attemptId);
      const row = await rowOf(attemptId);
      expect(row.evaluationStatus).toBe("pending");
      expect(row.evaluationStartedAt).toBeNull();
    });

    it("marks the attempt running with its start time while the model works", async () => {
      const seen: { status?: string; startedAt?: number | null } = {};
      const before = Date.now();
      const model = new MockLanguageModelV4({
        doGenerate: async () => {
          const row = await rowOf(attemptId);
          seen.status = row.evaluationStatus;
          seen.startedAt = row.evaluationStartedAt?.getTime() ?? null;
          return result(JSON.stringify(goodOutput));
        },
      });
      await serviceWith(model).evaluate(userId, attemptId);
      const after = Date.now();

      expect(seen.status).toBe("running");
      expect(seen.startedAt).toEqual(expect.any(Number));
      expect(seen.startedAt!).toBeGreaterThanOrEqual(before - 1000);
      expect(seen.startedAt!).toBeLessThanOrEqual(after + 1000);
      expect((await rowOf(attemptId)).evaluationStatus).toBe("done");
    });
  });

  describe("requeue", () => {
    it.each(["failed", "done"] as const)(
      "queues a %s evaluation and runs it again",
      async (status) => {
        await setRow(attemptId, { evaluationStatus: status });
        const model = goodModel();
        expect(await serviceWith(model).requeue(userId, attemptId)).toBe(
          "queued",
        );
        await vi.waitFor(async () => {
          expect((await rowOf(attemptId)).evaluationStatus).toBe("done");
        });
        expect(model.doGenerateCalls).toHaveLength(1);
      },
    );

    it("reports a running evaluation without touching it", async () => {
      const startedAt = new Date(Date.now() - 60_000);
      await setRow(attemptId, {
        evaluationStatus: "running",
        evaluationStartedAt: startedAt,
      });
      const model = goodModel();
      expect(await serviceWith(model).requeue(userId, attemptId)).toBe(
        "running",
      );
      // Give a (wrongly) started evaluation the chance to run.
      await new Promise((r) => setTimeout(r, 50));
      expect(model.doGenerateCalls).toHaveLength(0);
      const row = await rowOf(attemptId);
      expect(row.evaluationStatus).toBe("running");
      expect(row.evaluationStartedAt?.getTime()).toBe(startedAt.getTime());
    });

    it("reports not_found for an unknown attempt", async () => {
      expect(
        await serviceWith(goodModel()).requeue(
          userId,
          "00000000-0000-4000-8000-000000000000",
        ),
      ).toBe("not_found");
    });

    it("reports not_found for an attempt that is not completed", async () => {
      const a = await attempts.create({
        userId,
        mode: "practice",
        runId: null,
        exerciseId: null,
        task: 2,
        model: "gpt-realtime-mini",
      });
      await setRow(a.id, { evaluationStatus: "failed" });
      expect(await serviceWith(goodModel()).requeue(userId, a.id)).toBe(
        "not_found",
      );
      expect((await rowOf(a.id)).evaluationStatus).toBe("failed");
    });

    it("reports not_found for another user's running evaluation", async () => {
      const other = await testDb.createUser("intruder@test.local");
      await setRow(attemptId, { evaluationStatus: "running" });
      expect(await serviceWith(goodModel()).requeue(other, attemptId)).toBe(
        "not_found",
      );
    });

    it("never requeues another user's failed evaluation", async () => {
      const other = await testDb.createUser("intruder@test.local");
      await setRow(attemptId, { evaluationStatus: "failed" });
      expect(await serviceWith(goodModel()).requeue(other, attemptId)).toBe(
        "not_found",
      );
      expect((await rowOf(attemptId)).evaluationStatus).toBe("failed");
    });
  });

  describe("failStale", () => {
    const now = new Date("2026-03-10T12:00:00.000Z");
    const ago = (ms: number) => new Date(now.getTime() - ms);

    it("fails a running evaluation that started before the window", async () => {
      await setRow(attemptId, {
        evaluationStatus: "running",
        evaluationStartedAt: ago(STALE_RUNNING_MS + 1),
        finishedAt: ago(STALE_RUNNING_MS + 1),
      });
      await serviceWith(goodModel()).failStale(now);
      expect((await rowOf(attemptId)).evaluationStatus).toBe("failed");
    });

    it("keeps a running evaluation exactly at the edge of the window", async () => {
      await setRow(attemptId, {
        evaluationStatus: "running",
        evaluationStartedAt: ago(STALE_RUNNING_MS),
        finishedAt: ago(STALE_RUNNING_MS),
      });
      await serviceWith(goodModel()).failStale(now);
      expect((await rowOf(attemptId)).evaluationStatus).toBe("running");
    });

    it("keeps a recently requeued evaluation of an old attempt running", async () => {
      await setRow(attemptId, {
        evaluationStatus: "running",
        evaluationStartedAt: ago(60_000),
        finishedAt: ago(30 * 24 * 3600_000),
      });
      await serviceWith(goodModel()).failStale(now);
      expect((await rowOf(attemptId)).evaluationStatus).toBe("running");
    });

    it("falls back to finishedAt when the start time is unknown", async () => {
      const recent = await attempts.create({
        userId,
        mode: "practice",
        runId: null,
        exerciseId: null,
        task: 3,
        model: "gpt-realtime-mini",
      });
      await setRow(attemptId, {
        evaluationStatus: "running",
        evaluationStartedAt: null,
        finishedAt: ago(STALE_RUNNING_MS + 60_000),
      });
      await setRow(recent.id, {
        status: "completed",
        evaluationStatus: "running",
        evaluationStartedAt: null,
        finishedAt: ago(60_000),
      });
      await serviceWith(goodModel()).failStale(now);
      expect((await rowOf(attemptId)).evaluationStatus).toBe("failed");
      expect((await rowOf(recent.id)).evaluationStatus).toBe("running");
    });

    it.each(["pending", "done"] as const)(
      "never touches a %s evaluation",
      async (status) => {
        await setRow(attemptId, {
          evaluationStatus: status,
          evaluationStartedAt: ago(24 * 3600_000),
          finishedAt: ago(24 * 3600_000),
        });
        await serviceWith(goodModel()).failStale(now);
        expect((await rowOf(attemptId)).evaluationStatus).toBe(status);
      },
    );
  });
});
