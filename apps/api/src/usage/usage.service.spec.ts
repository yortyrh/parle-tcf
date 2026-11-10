import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { examAttempts, usageLimits } from "@parle-tcf/db";
import { UsageService } from "./usage.service.js";

type AttemptInsert = typeof examAttempts.$inferInsert;

const MIN = 60_000;

describe("UsageService", () => {
  let testDb: TestDb;
  let service: UsageService;
  let alice: string;
  let bob: string;
  const originalTz = process.env.TZ;

  beforeAll(async () => {
    testDb = await createTestDb();
    service = new UsageService(testDb.db);
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
    alice = await testDb.createUser("alice@test.local");
    bob = await testDb.createUser("bob@test.local");
  });
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  /** A finished attempt (completed unless stated) with stored minutes and cost. */
  const finished = (
    userId: string,
    startedAt: Date,
    minutes: number,
    cost = 0,
    extra: Partial<AttemptInsert> = {},
  ) =>
    testDb.db.insert(examAttempts).values({
      userId,
      mode: "practice",
      task: 2,
      provider: "openai",
      model: "gpt-realtime-mini",
      status: "completed",
      startedAt,
      lastActivityAt: startedAt,
      finishedAt: startedAt,
      realtimeMinutes: minutes.toFixed(2),
      estimatedCostUsd: cost.toFixed(4),
      ...extra,
    });

  const inProgress = (userId: string, startedAt: Date, lastActivityAt: Date) =>
    testDb.db.insert(examAttempts).values({
      userId,
      mode: "practice",
      task: 2,
      provider: "openai",
      model: "gpt-realtime-mini",
      status: "in_progress",
      startedAt,
      lastActivityAt,
    });

  const limitsFor = (userId: string, dailyMinutes: number, monthly: string) =>
    testDb.db
      .insert(usageLimits)
      .values({ userId, dailyMinutes, monthlyCostUsd: monthly });

  describe("UTC boundaries", () => {
    // 00:30 UTC: still the previous calendar day west of Greenwich.
    const now = new Date("2026-03-10T00:30:00.000Z");

    it.each(["America/Los_Angeles", "Asia/Tokyo", "UTC"])(
      "counts the UTC day only (server TZ %s)",
      async (tz) => {
        process.env.TZ = tz;
        await finished(alice, new Date("2026-03-10T00:00:00.000Z"), 4);
        await finished(alice, new Date("2026-03-09T23:59:59.999Z"), 100);
        await finished(alice, new Date("2026-03-09T12:00:00.000Z"), 1000);

        expect((await service.get(alice, now)).todayMinutes).toBeCloseTo(4, 5);
      },
    );

    it.each(["America/Los_Angeles", "Asia/Tokyo", "UTC"])(
      "counts the UTC month only (server TZ %s)",
      async (tz) => {
        process.env.TZ = tz;
        const firstOfMonth = new Date("2026-03-01T00:30:00.000Z");
        await finished(alice, new Date("2026-03-01T00:00:00.000Z"), 0, 1.25);
        await finished(alice, new Date("2026-02-28T23:59:59.999Z"), 0, 7);
        await finished(alice, new Date("2026-02-15T12:00:00.000Z"), 0, 50);

        expect(
          (await service.get(alice, firstOfMonth)).monthCostUsd,
        ).toBeCloseTo(1.25, 4);
      },
    );

    it("counts the whole month, not just today, for the cost", async () => {
      const mid = new Date("2026-03-20T12:00:00.000Z");
      await finished(alice, new Date("2026-03-02T08:00:00.000Z"), 30, 2);
      await finished(alice, new Date("2026-03-20T08:00:00.000Z"), 10, 0.5);

      const usage = await service.get(alice, mid);
      expect(usage.monthCostUsd).toBeCloseTo(2.5, 4);
      expect(usage.todayMinutes).toBeCloseTo(10, 5);
    });
  });

  describe("todayMinutes", () => {
    const now = new Date("2026-03-10T15:00:00.000Z");

    it("adds the elapsed time of in-progress attempts up to their last activity", async () => {
      await finished(alice, new Date(now.getTime() - 120 * MIN), 5);
      await inProgress(
        alice,
        new Date(now.getTime() - 30 * MIN),
        new Date(now.getTime() - 10 * MIN),
      );

      expect((await service.get(alice, now)).todayMinutes).toBeCloseTo(25, 5);
    });

    it("ignores in-progress attempts started before today (UTC)", async () => {
      await inProgress(
        alice,
        new Date("2026-03-09T23:50:00.000Z"),
        new Date("2026-03-10T00:20:00.000Z"),
      );
      expect((await service.get(alice, now)).todayMinutes).toBe(0);
    });

    it("uses stored minutes, not timestamps, for finished attempts", async () => {
      // lastActivityAt - startedAt is 60 min, but only 5 / 3 minutes were billed.
      await finished(alice, new Date(now.getTime() - 90 * MIN), 5, 0, {
        lastActivityAt: new Date(now.getTime() - 30 * MIN),
      });
      await finished(alice, new Date(now.getTime() - 90 * MIN), 3, 0, {
        status: "interrupted",
        lastActivityAt: new Date(now.getTime() - 30 * MIN),
      });

      expect((await service.get(alice, now)).todayMinutes).toBeCloseTo(8, 5);
    });

    it("never counts other users' attempts", async () => {
      await finished(bob, new Date(now.getTime() - 60 * MIN), 40, 9);
      await inProgress(
        bob,
        new Date(now.getTime() - 50 * MIN),
        new Date(now.getTime() - MIN),
      );
      await finished(alice, new Date(now.getTime() - 60 * MIN), 2, 0.1);

      const usage = await service.get(alice, now);
      expect(usage.todayMinutes).toBeCloseTo(2, 5);
      expect(usage.monthCostUsd).toBeCloseTo(0.1, 4);
    });

    it("uses the user's own limits row, not another user's", async () => {
      await limitsFor(bob, 5, "1.00");
      await limitsFor(alice, 42, "3.50");
      const usage = await service.get(alice, now);
      expect(usage.dailyMinutesLimit).toBe(42);
      expect(usage.monthlyCostLimitUsd).toBe(3.5);
    });
  });

  describe("isOverLimit", () => {
    const now = new Date("2026-03-10T15:00:00.000Z");
    const earlier = new Date(now.getTime() - 3 * 3600_000);

    beforeEach(async () => {
      await limitsFor(alice, 10, "1.00");
    });

    it("is false under both limits", async () => {
      await finished(alice, earlier, 9.99, 0.99);
      expect(await service.isOverLimit(alice, now)).toBe(false);
    });

    it("is true when today's minutes reach the daily limit exactly", async () => {
      await finished(alice, earlier, 10, 0);
      expect(await service.isOverLimit(alice, now)).toBe(true);
    });

    it("is true when the month cost reaches the monthly limit exactly", async () => {
      await finished(alice, earlier, 0, 1);
      expect(await service.isOverLimit(alice, now)).toBe(true);
    });

    it("counts the session still in progress", async () => {
      await finished(alice, earlier, 4, 0);
      await inProgress(
        alice,
        new Date(now.getTime() - 7 * MIN),
        new Date(now.getTime() - MIN),
      );
      expect(await service.isOverLimit(alice, now)).toBe(true);
    });

    it("uses the injected clock for the day", async () => {
      await finished(alice, earlier, 10, 0);
      const tomorrow = new Date("2026-03-11T00:00:00.000Z");
      expect(await service.isOverLimit(alice, tomorrow)).toBe(false);
    });

    it("is not affected by another user being over the limit", async () => {
      await limitsFor(bob, 1, "0.01");
      await finished(bob, earlier, 100, 100);
      expect(await service.isOverLimit(alice, now)).toBe(false);
      expect(await service.isOverLimit(bob, now)).toBe(true);
    });
  });

  describe("assertWithinLimits", () => {
    it("throws LIMIT_REACHED (429) at the daily limit and passes just under it", async () => {
      await limitsFor(alice, 10, "100.00");
      await finished(alice, new Date(), 9.99, 0);
      await expect(service.assertWithinLimits(alice)).resolves.toBeUndefined();

      await finished(alice, new Date(), 0.01, 0);
      await expect(service.assertWithinLimits(alice)).rejects.toMatchObject({
        code: "LIMIT_REACHED",
        status: 429,
      });
    });

    it("throws LIMIT_REACHED (429) at the monthly cost limit", async () => {
      await limitsFor(alice, 1000, "1.00");
      await finished(alice, new Date(), 0, 1);
      await expect(service.assertWithinLimits(alice)).rejects.toMatchObject({
        code: "LIMIT_REACHED",
        status: 429,
      });
    });
  });
});
