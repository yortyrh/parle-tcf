import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { eq, evaluations, examAttempts, examRuns } from "@parle-tcf/db";
import { AttemptsService, STALE_ATTEMPT_MS } from "./attempts.service.js";

const base = { exerciseId: null, task: 2, model: "gpt-realtime-mini" };

const T0 = new Date("2026-03-10T10:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

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

  const patch = (
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

  /** An in-progress attempt of `userId` that started at T0. */
  const startedAtT0 = async (userId: string) => {
    const attempt = await createFor(userId);
    await patch(attempt.id, { startedAt: T0, lastActivityAt: T0 });
    return attempt;
  };

  it("checkpoints idempotently by seq and completes with usage", async () => {
    const attempt = await startedAtT0(alice);
    expect(attempt.status).toBe("in_progress");

    await service.checkpoint(alice, attempt.id, [
      { seq: 0, speaker: "examiner", text: "Bonjour" },
      { seq: 1, speaker: "candidate", text: "Salut" },
    ]);
    await service.checkpoint(alice, attempt.id, [
      { seq: 1, speaker: "candidate", text: "Salut, ça va ?" },
      { seq: 2, speaker: "examiner", text: "Oui" },
    ]);
    await service.complete(
      alice,
      {
        attemptId: attempt.id,
        lines: [],
        usage: { inputTokens: 10, outputTokens: 20 },
      },
      at(90_000),
    );

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
      service.complete(bob, { attemptId: attempt.id, lines: [] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.touchStart(bob, attempt.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.delete(bob, attempt.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(await service.list(bob, {})).toEqual({ items: [], total: 0 });
    // Alice's attempt is untouched.
    expect((await service.get(alice, attempt.id)).status).toBe("in_progress");
  });

  describe("complete", () => {
    it("computes the duration from startedAt on the server and returns true", async () => {
      const attempt = await startedAtT0(alice);
      const now = at(100_000);

      expect(
        await service.complete(
          alice,
          {
            attemptId: attempt.id,
            lines: [{ seq: 0, speaker: "candidate", text: "Bonjour" }],
          },
          now,
        ),
      ).toBe(true);

      const row = await rowOf(attempt.id);
      expect(row.status).toBe("completed");
      expect(row.durationS).toBe(100);
      expect(Number(row.realtimeMinutes)).toBe(1.67);
      expect(row.finishedAt?.getTime()).toBe(now.getTime());
      expect(row.evaluationStatus).toBe("pending");
      expect(
        (await service.get(alice, attempt.id)).transcript.map((l) => l.text),
      ).toEqual(["Bonjour"]);
    });

    it("rounds the duration to the nearest second", async () => {
      const down = await startedAtT0(alice);
      await service.complete(
        alice,
        { attemptId: down.id, lines: [] },
        at(90_400),
      );
      expect((await rowOf(down.id)).durationS).toBe(90);

      const up = await startedAtT0(alice);
      await service.complete(
        alice,
        { attemptId: up.id, lines: [] },
        at(90_600),
      );
      expect((await rowOf(up.id)).durationS).toBe(91);
    });

    it("caps the duration at one hour", async () => {
      const exact = await startedAtT0(alice);
      await service.complete(
        alice,
        { attemptId: exact.id, lines: [] },
        at(3600_000),
      );
      expect((await rowOf(exact.id)).durationS).toBe(3600);

      const over = await startedAtT0(alice);
      await service.complete(
        alice,
        { attemptId: over.id, lines: [] },
        at(3601_000),
      );
      expect((await rowOf(over.id)).durationS).toBe(3600);

      const longOver = await startedAtT0(alice);
      await service.complete(
        alice,
        { attemptId: longOver.id, lines: [] },
        at(5 * 3600_000),
      );
      const row = await rowOf(longOver.id);
      expect(row.durationS).toBe(3600);
      expect(Number(row.realtimeMinutes)).toBe(60);
    });

    it("keeps one second under the cap as is", async () => {
      const attempt = await startedAtT0(alice);
      await service.complete(
        alice,
        { attemptId: attempt.id, lines: [] },
        at(3599_000),
      );
      expect((await rowOf(attempt.id)).durationS).toBe(3599);
    });

    it("never stores a negative duration (clock skew)", async () => {
      const attempt = await startedAtT0(alice);
      await service.complete(
        alice,
        { attemptId: attempt.id, lines: [] },
        at(-30_000),
      );
      const row = await rowOf(attempt.id);
      expect(row.durationS).toBe(0);
      expect(Number(row.realtimeMinutes)).toBe(0);
    });

    it("completes an interrupted attempt", async () => {
      const attempt = await startedAtT0(alice);
      await patch(attempt.id, { status: "interrupted" });

      expect(
        await service.complete(
          alice,
          { attemptId: attempt.id, lines: [] },
          at(60_000),
        ),
      ).toBe(true);
      const row = await rowOf(attempt.id);
      expect(row.status).toBe("completed");
      expect(row.durationS).toBe(60);
      expect(row.evaluationStatus).toBe("pending");
    });

    it("is idempotent: completing twice changes nothing and returns false", async () => {
      const attempt = await startedAtT0(alice);
      await service.complete(
        alice,
        {
          attemptId: attempt.id,
          lines: [{ seq: 0, speaker: "candidate", text: "Première" }],
          usage: { inputTokens: 1000, outputTokens: 500 },
        },
        at(120_000),
      );
      // The evaluation already ran.
      await patch(attempt.id, { evaluationStatus: "done" });
      const before = await rowOf(attempt.id);

      expect(
        await service.complete(
          alice,
          {
            attemptId: attempt.id,
            lines: [
              { seq: 0, speaker: "candidate", text: "Remplacée" },
              { seq: 1, speaker: "examiner", text: "Nouvelle" },
            ],
            usage: { inputTokens: 99_999, outputTokens: 99_999 },
          },
          at(1800_000),
        ),
      ).toBe(false);

      const after = await rowOf(attempt.id);
      expect(after).toEqual(before);
      expect(after.evaluationStatus).toBe("done");
      expect(after.durationS).toBe(120);
      expect(
        (await service.get(alice, attempt.id)).transcript.map((l) => [
          l.seq,
          l.text,
        ]),
      ).toEqual([[0, "Première"]]);
    });

    it("rejects another user's attempt without changing it", async () => {
      const attempt = await startedAtT0(alice);
      await expect(
        service.complete(
          bob,
          {
            attemptId: attempt.id,
            lines: [{ seq: 0, speaker: "candidate", text: "Intrus" }],
          },
          at(60_000),
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      const row = await rowOf(attempt.id);
      expect(row.status).toBe("in_progress");
      expect(row.finishedAt).toBeNull();
      expect(row.durationS).toBeNull();
      expect((await service.get(alice, attempt.id)).transcript).toEqual([]);
    });
  });

  describe("checkpoint", () => {
    it("saves lines and records activity on an in-progress attempt", async () => {
      const attempt = await startedAtT0(alice);
      const now = at(5 * 60_000);
      await service.checkpoint(
        alice,
        attempt.id,
        [{ seq: 0, speaker: "examiner", text: "Bonjour" }],
        now,
      );
      expect((await rowOf(attempt.id)).lastActivityAt.getTime()).toBe(
        now.getTime(),
      );
      expect(
        (await service.get(alice, attempt.id)).transcript.map((l) => l.text),
      ).toEqual(["Bonjour"]);
    });

    it.each(["completed", "interrupted"] as const)(
      "silently ignores a %s attempt",
      async (status) => {
        const attempt = await startedAtT0(alice);
        await patch(attempt.id, { status });

        await expect(
          service.checkpoint(
            alice,
            attempt.id,
            [{ seq: 0, speaker: "candidate", text: "Trop tard" }],
            at(10 * 60_000),
          ),
        ).resolves.toBeUndefined();

        const row = await rowOf(attempt.id);
        expect(row.status).toBe(status);
        expect(row.lastActivityAt.getTime()).toBe(T0.getTime());
        expect((await service.get(alice, attempt.id)).transcript).toEqual([]);
      },
    );

    it("rejects another user's attempt without saving or touching it", async () => {
      const attempt = await startedAtT0(alice);
      await expect(
        service.checkpoint(
          bob,
          attempt.id,
          [{ seq: 0, speaker: "candidate", text: "Intrus" }],
          at(60_000),
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await rowOf(attempt.id)).lastActivityAt.getTime()).toBe(
        T0.getTime(),
      );
      expect((await service.get(alice, attempt.id)).transcript).toEqual([]);
    });
  });

  describe("touchStart", () => {
    it("restarts the clock of an in-progress attempt", async () => {
      const attempt = await startedAtT0(alice);
      const now = at(20 * 60_000);

      const row = await service.touchStart(alice, attempt.id, now);
      expect(row.id).toBe(attempt.id);
      expect(row.startedAt.getTime()).toBe(now.getTime());
      expect(row.lastActivityAt.getTime()).toBe(now.getTime());

      const stored = await rowOf(attempt.id);
      expect(stored.startedAt.getTime()).toBe(now.getTime());
      expect(stored.lastActivityAt.getTime()).toBe(now.getTime());
      expect(stored.status).toBe("in_progress");
    });

    it.each(["completed", "interrupted"] as const)(
      "refuses a %s attempt with CONFLICT",
      async (status) => {
        const attempt = await startedAtT0(alice);
        await patch(attempt.id, { status });
        await expect(
          service.touchStart(alice, attempt.id, at(60_000)),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect((await rowOf(attempt.id)).startedAt.getTime()).toBe(
          T0.getTime(),
        );
      },
    );

    it("does not touch another user's attempt", async () => {
      const attempt = await startedAtT0(alice);
      await expect(
        service.touchStart(bob, attempt.id, at(60_000)),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const row = await rowOf(attempt.id);
      expect(row.startedAt.getTime()).toBe(T0.getTime());
      expect(row.lastActivityAt.getTime()).toBe(T0.getTime());
    });
  });

  describe("interruptStale", () => {
    it("uses a 15 minute window", () => {
      expect(STALE_ATTEMPT_MS).toBe(15 * 60_000);
    });

    it("interrupts in-progress attempts idle longer than the window", async () => {
      const now = at(60 * 60_000);
      const stale = await startedAtT0(alice);
      const lastActivity = new Date(now.getTime() - STALE_ATTEMPT_MS - 1);
      await patch(stale.id, { lastActivityAt: lastActivity });
      const bobStale = await startedAtT0(bob);
      await patch(bobStale.id, { lastActivityAt: lastActivity });

      expect(await service.interruptStale(now)).toBe(2);

      const row = await rowOf(stale.id);
      expect(row.status).toBe("interrupted");
      expect(row.finishedAt?.getTime()).toBe(lastActivity.getTime());
      // 45 min - 1 ms of activity, rounded to the second.
      expect(row.durationS).toBe(45 * 60);
      expect(Number(row.realtimeMinutes)).toBe(45);
      expect((await rowOf(bobStale.id)).status).toBe("interrupted");
    });

    it("leaves attempts active within the window, including exactly at its edge", async () => {
      const now = at(60 * 60_000);
      const edge = await startedAtT0(alice);
      await patch(edge.id, {
        lastActivityAt: new Date(now.getTime() - STALE_ATTEMPT_MS),
      });
      const recent = await startedAtT0(alice);
      await patch(recent.id, {
        lastActivityAt: new Date(now.getTime() - 60_000),
      });

      expect(await service.interruptStale(now)).toBe(0);
      for (const id of [edge.id, recent.id]) {
        const row = await rowOf(id);
        expect(row.status).toBe("in_progress");
        expect(row.finishedAt).toBeNull();
        expect(row.durationS).toBeNull();
      }
    });

    it("does not touch attempts that are not in progress", async () => {
      const now = at(5 * 3600_000);
      const done = await startedAtT0(alice);
      await service.complete(
        alice,
        { attemptId: done.id, lines: [] },
        at(60_000),
      );
      const before = await rowOf(done.id);
      const interrupted = await startedAtT0(alice);
      await patch(interrupted.id, { status: "interrupted" });

      expect(await service.interruptStale(now)).toBe(0);
      expect(await rowOf(done.id)).toEqual(before);
      expect((await rowOf(interrupted.id)).finishedAt).toBeNull();
    });

    it("caps the duration at one hour and never goes negative", async () => {
      const now = at(10 * 3600_000);
      const long = await startedAtT0(alice);
      await patch(long.id, { lastActivityAt: at(3 * 3600_000) });
      const skewed = await startedAtT0(alice);
      await patch(skewed.id, { lastActivityAt: at(-60_000) });

      expect(await service.interruptStale(now)).toBe(2);
      const longRow = await rowOf(long.id);
      expect(longRow.durationS).toBe(3600);
      expect(Number(longRow.realtimeMinutes)).toBe(60);
      const skewedRow = await rowOf(skewed.id);
      expect(skewedRow.durationS).toBe(0);
      expect(Number(skewedRow.realtimeMinutes)).toBe(0);
    });
  });

  describe("getRun", () => {
    const fullFor = (userId: string, task: number, runId: string | null) =>
      service.create({
        userId,
        mode: "full",
        runId,
        exerciseId: null,
        task,
        model: "gpt-realtime-mini",
      });

    const grade = (attemptId: string, level: string) =>
      testDb.db.insert(evaluations).values({
        attemptId,
        globalLevel: level,
        levels: {},
        correctorModel: "gpt-4o-mini",
        rubricVersion: "v1",
      });

    it("returns the run with its attempts ordered by task then start", async () => {
      const t3 = await fullFor(alice, 3, null);
      const runId = t3.runId!;
      const t1 = await fullFor(alice, 1, runId);
      const t2late = await fullFor(alice, 2, runId);
      const t2early = await fullFor(alice, 2, runId);
      await patch(t3.id, { startedAt: at(0) });
      await patch(t1.id, { startedAt: at(3 * 60_000) });
      await patch(t2late.id, { startedAt: at(2 * 60_000) });
      await patch(t2early.id, { startedAt: at(60_000) });
      // An attempt outside the run must not appear.
      await fullFor(alice, 1, null);
      await createFor(alice);

      await grade(t1.id, "B2");
      await testDb.db
        .update(examRuns)
        .set({ globalLevel: "B1", finishedAt: at(10 * 60_000) })
        .where(eq(examRuns.id, runId));

      const run = await service.getRun(alice, runId);
      expect(run).toMatchObject({
        id: runId,
        mode: "full",
        globalLevel: "B1",
        finishedAt: at(10 * 60_000).toISOString(),
      });
      expect(typeof run.startedAt).toBe("string");
      expect(run.attempts.map((a) => a.id)).toEqual([
        t1.id,
        t2early.id,
        t2late.id,
        t3.id,
      ]);
      expect(run.attempts.map((a) => a.globalLevel)).toEqual([
        "B2",
        null,
        null,
        null,
      ]);
    });

    it("returns null levels and finishedAt for an unfinished run", async () => {
      const first = await fullFor(alice, 1, null);
      const run = await service.getRun(alice, first.runId!);
      expect(run.globalLevel).toBeNull();
      expect(run.finishedAt).toBeNull();
      expect(run.attempts).toHaveLength(1);
    });

    it("hides unknown runs and other users' runs", async () => {
      const first = await fullFor(alice, 1, null);
      await expect(
        service.getRun(alice, "00000000-0000-4000-8000-000000000000"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.getRun(bob, first.runId!)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("only lists the run owner's attempts", async () => {
      const first = await fullFor(alice, 1, null);
      // Defensive: a foreign attempt pointing at the run (not reachable via create).
      const intruder = await fullFor(bob, 2, null);
      await patch(intruder.id, { runId: first.runId });

      const run = await service.getRun(alice, first.runId!);
      expect(run.attempts.map((a) => a.id)).toEqual([first.id]);
    });
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
