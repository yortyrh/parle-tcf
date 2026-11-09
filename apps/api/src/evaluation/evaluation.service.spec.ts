import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { examAttempts, examRuns, eq } from "@parle-tcf/db";
import { AttemptsService } from "../attempts/attempts.service.js";
import { ProviderSettingsService } from "../settings/provider-settings.service.js";
import { fakeVoiceProvider, testCipher } from "../test-helpers.js";
import { EvaluationService, locateErrors } from "./evaluation.service.js";

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
      fakeVoiceProvider(),
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
      durationS: 120,
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
    expect(await serviceWith(model).requeue(other, attemptId)).toBe(false);
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
        durationS: 60,
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
});
