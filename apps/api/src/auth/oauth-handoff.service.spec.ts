import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, verification } from "@parle-tcf/db";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { OAuthHandoffService } from "./oauth-handoff.service.js";

const PREFIX = "oauth-handoff:";
const TTL_MS = 2 * 60 * 1000;
const T0 = new Date("2026-03-01T10:00:00.000Z");

describe("OAuthHandoffService", () => {
  let testDb: TestDb;
  let service: OAuthHandoffService;

  beforeAll(async () => {
    testDb = await createTestDb();
    service = new OAuthHandoffService(testDb.db);
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
  });

  const rowsFor = (code: string) =>
    testDb.db
      .select()
      .from(verification)
      .where(eq(verification.identifier, PREFIX + code));

  const allRows = () => testDb.db.select().from(verification);

  describe("issue", () => {
    it("returns a long base64url code and stores the token for two minutes", async () => {
      const before = Date.now();
      const code = await service.issue("session-token-1");
      const after = Date.now();

      expect(code).toMatch(/^[A-Za-z0-9_-]{43,}$/);
      const rows = await rowsFor(code);
      expect(rows).toHaveLength(1);
      expect(rows[0].identifier).toBe(PREFIX + code);
      expect(rows[0].value).toBe("session-token-1");
      const expiresAt = rows[0].expiresAt.getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + TTL_MS - 5_000);
      expect(expiresAt).toBeLessThanOrEqual(after + TTL_MS + 5_000);
    });

    it("stores exactly one row per issue, under the prefixed code", async () => {
      const code = await service.issue("session-token-1");
      const rows = await allRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].identifier).toBe(PREFIX + code);
    });

    it("issues a different code each time", async () => {
      const codes = new Set<string>();
      for (let i = 0; i < 5; i++) codes.add(await service.issue("same-token"));
      expect(codes.size).toBe(5);
      expect(await allRows()).toHaveLength(5);
    });

    it("computes the expiry from the injected clock", async () => {
      const clocked = new OAuthHandoffService(testDb.db, () => T0);
      const code = await clocked.issue("session-token-2");

      const [row] = await rowsFor(code);
      const delta = row.expiresAt.getTime() - T0.getTime();
      expect(delta).toBeGreaterThanOrEqual(TTL_MS - 5_000);
      expect(delta).toBeLessThanOrEqual(TTL_MS + 5_000);
    });
  });

  describe("redeem", () => {
    it("returns the token once and deletes the row", async () => {
      const code = await service.issue("session-token-3");

      expect(await service.redeem(code)).toBe("session-token-3");
      expect(await rowsFor(code)).toHaveLength(0);
      expect(await service.redeem(code)).toBeNull();
    });

    it("returns null for an unknown code", async () => {
      await service.issue("session-token-4");
      expect(await service.redeem("x".repeat(43))).toBeNull();
      expect(await allRows()).toHaveLength(1);
    });

    it("returns null for an empty code", async () => {
      await service.issue("session-token-5");
      expect(await service.redeem("")).toBeNull();
      expect(await allRows()).toHaveLength(1);
    });

    it("only consumes the redeemed code", async () => {
      const first = await service.issue("token-a");
      const second = await service.issue("token-b");

      expect(await service.redeem(first)).toBe("token-a");
      expect(await rowsFor(second)).toHaveLength(1);
      expect(await service.redeem(second)).toBe("token-b");
    });

    it("ignores verification rows without the handoff prefix", async () => {
      const code = "a".repeat(43);
      await testDb.db.insert(verification).values({
        identifier: code,
        value: "not-a-handoff",
        expiresAt: new Date(Date.now() + 60_000),
      });

      expect(await service.redeem(code)).toBeNull();
    });

    it("does not let a raw identifier be redeemed as a code", async () => {
      const code = await service.issue("session-token-6");
      expect(await service.redeem(PREFIX + code)).toBeNull();
      expect(await service.redeem(code)).toBe("session-token-6");
    });

    it("returns null for a row that has already expired", async () => {
      const code = "b".repeat(43);
      await testDb.db.insert(verification).values({
        identifier: PREFIX + code,
        value: "stale-token",
        expiresAt: new Date(Date.now() - 1_000),
      });

      expect(await service.redeem(code)).toBeNull();
    });

    it("accepts a code just before expiry and rejects it just after", async () => {
      let now = T0;
      const clocked = new OAuthHandoffService(testDb.db, () => now);
      const early = await clocked.issue("token-early");
      const late = await clocked.issue("token-late");

      now = new Date(T0.getTime() + TTL_MS - 10_000);
      expect(await clocked.redeem(early)).toBe("token-early");

      now = new Date(T0.getTime() + TTL_MS + 10_000);
      expect(await clocked.redeem(late)).toBeNull();
    });
  });
});
