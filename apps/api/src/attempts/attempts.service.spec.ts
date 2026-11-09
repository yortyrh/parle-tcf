import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { AttemptsService } from "./attempts.service.js";

const base = { exerciseId: null, task: 2, model: "gpt-realtime-mini" };

describe("AttemptsService", () => {
  let testDb: TestDb;
  let service: AttemptsService;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    service = new AttemptsService(testDb.db);
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
    alice = await testDb.createUser("alice@test.local");
    bob = await testDb.createUser("bob@test.local");
  });

  const createFor = (userId: string) =>
    service.create({ userId, mode: "practice", runId: null, ...base });

  it("checkpoints idempotently by seq and completes with usage", async () => {
    const attempt = await createFor(alice);
    expect(attempt.status).toBe("in_progress");

    await service.checkpoint(alice, attempt.id, [
      { seq: 0, speaker: "examiner", text: "Bonjour" },
      { seq: 1, speaker: "candidate", text: "Salut" },
    ]);
    await service.checkpoint(alice, attempt.id, [
      { seq: 1, speaker: "candidate", text: "Salut, ça va ?" },
      { seq: 2, speaker: "examiner", text: "Oui" },
    ]);
    await service.complete(alice, {
      attemptId: attempt.id,
      lines: [],
      durationS: 90,
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const detail = await service.get(alice, attempt.id);
    expect(detail.status).toBe("completed");
    expect(detail.durationS).toBe(90);
    expect(detail.evaluationStatus).toBe("pending");
    expect(detail.transcript.map((l) => [l.seq, l.text])).toEqual([
      [0, "Bonjour"],
      [1, "Salut, ça va ?"],
      [2, "Oui"],
    ]);
  });

  it("treats another user's attempt as not found on every operation", async () => {
    const attempt = await createFor(alice);

    await expect(service.get(bob, attempt.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.checkpoint(bob, attempt.id, [])).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
      },
    );
    await expect(
      service.complete(bob, {
        attemptId: attempt.id,
        lines: [],
        durationS: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.delete(bob, attempt.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(await service.list(bob, {})).toEqual({ items: [], total: 0 });
    // Alice's attempt is untouched.
    expect((await service.get(alice, attempt.id)).status).toBe("in_progress");
  });

  it("lists with filters and pagination, newest first", async () => {
    await createFor(alice);
    await service.create({
      userId: alice,
      mode: "practice",
      runId: null,
      exerciseId: null,
      task: 3,
      model: "m",
    });
    const all = await service.list(alice, {});
    expect(all.total).toBe(2);
    expect(all.items[0]?.task).toBe(3);
    expect((await service.list(alice, { task: 2 })).items).toHaveLength(1);
    expect(
      (await service.list(alice, { limit: 1, offset: 1 })).items,
    ).toHaveLength(1);
  });

  it("groups full-exam attempts under one run and rejects foreign runs", async () => {
    const first = await service.create({
      userId: alice,
      mode: "full",
      runId: null,
      ...base,
    });
    expect(first.runId).toBeTruthy();

    const second = await service.create({
      userId: alice,
      mode: "full",
      runId: first.runId,
      ...base,
    });
    expect(second.runId).toBe(first.runId);

    await expect(
      service.create({
        userId: bob,
        mode: "full",
        runId: first.runId,
        ...base,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deleting a user removes their attempts and transcripts", async () => {
    const attempt = await createFor(alice);
    await service.checkpoint(alice, attempt.id, [
      { seq: 0, speaker: "candidate", text: "x" },
    ]);
    await service.delete(alice, attempt.id);
    await expect(service.get(alice, attempt.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
