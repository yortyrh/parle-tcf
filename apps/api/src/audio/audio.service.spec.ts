import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { eq, examAttempts } from "@parle-tcf/db";
import { AUDIO_MAX_BYTES } from "@parle-tcf/shared";
import { AttemptsService } from "../attempts/attempts.service.js";
import type { AudioStorage } from "./audio-storage.js";
import { AudioService } from "./audio.service.js";

function fakeStorage() {
  const calls = {
    deleted: [] as string[],
    prefixes: [] as string[],
    presigned: [] as { key: string; contentType: string; maxBytes: number }[],
    heads: [] as string[],
  };
  /** Objects "uploaded" to the bucket: key -> size in bytes. */
  const objects = new Map<string, number>();
  const storage: AudioStorage = {
    presignUpload: async (key, contentType, maxBytes) => {
      calls.presigned.push({ key, contentType, maxBytes });
      return {
        url: "https://s3.test/bucket",
        fields: { key, "Content-Type": contentType, policy: "p" },
      };
    },
    presignDownload: async (key) => `https://s3.test/get/${key}`,
    head: async (key) => {
      calls.heads.push(key);
      const size = objects.get(key);
      return size === undefined ? null : { size };
    },
    delete: async (key) => {
      calls.deleted.push(key);
      objects.delete(key);
    },
    deletePrefix: async (p) => void calls.prefixes.push(p),
  };
  return { storage, calls, objects };
}

describe("AudioService", () => {
  let testDb: TestDb;
  let attempts: AttemptsService;
  let alice: string;
  let bob: string;
  let attemptId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
    alice = await testDb.createUser("alice@test.local");
    bob = await testDb.createUser("bob@test.local");
    attempts = new AttemptsService(testDb.db);
    attemptId = (
      await attempts.create({
        userId: alice,
        mode: "practice",
        runId: null,
        exerciseId: null,
        task: 2,
        model: "gpt-realtime-mini",
      })
    ).id;
  });

  const input = () => ({ attemptId, contentType: "audio/webm" as const });
  const aliceKey = () => `audio/${alice}/${attemptId}`;
  const storedKey = async (id = attemptId) => {
    const [row] = await testDb.db
      .select({ key: examAttempts.audioKey })
      .from(examAttempts)
      .where(eq(examAttempts.id, id));
    return row?.key ?? null;
  };

  it("is unavailable without storage", async () => {
    const svc = new AudioService(testDb.db, null);
    expect(await svc.status(alice)).toEqual({
      available: false,
      consent: false,
    });
    await expect(svc.uploadUrl(alice, input())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(svc.confirmUpload(alice, attemptId)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("refuses uploads without explicit consent", async () => {
    const { storage, calls } = fakeStorage();
    const svc = new AudioService(testDb.db, storage);
    await expect(svc.uploadUrl(alice, input())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(calls.presigned).toEqual([]);
  });

  describe("uploadUrl", () => {
    it("signs a size-limited upload under the user's prefix", async () => {
      const { storage, calls } = fakeStorage();
      const svc = new AudioService(testDb.db, storage);
      await svc.setConsent(alice, true);

      const out = await svc.uploadUrl(alice, input());
      expect(out).toEqual({
        url: "https://s3.test/bucket",
        fields: { key: aliceKey(), "Content-Type": "audio/webm", policy: "p" },
        contentType: "audio/webm",
        maxBytes: AUDIO_MAX_BYTES,
      });
      expect(calls.presigned).toEqual([
        {
          key: aliceKey(),
          contentType: "audio/webm",
          maxBytes: AUDIO_MAX_BYTES,
        },
      ]);
    });

    it("does not record the recording before the upload is confirmed", async () => {
      const { storage } = fakeStorage();
      const svc = new AudioService(testDb.db, storage);
      await svc.setConsent(alice, true);
      await svc.uploadUrl(alice, input());

      expect(await storedKey()).toBeNull();
      expect((await svc.downloadUrl(alice, attemptId)).url).toBeNull();
    });
  });

  describe("confirmUpload", () => {
    it("records the recording once the object exists", async () => {
      const { storage, calls, objects } = fakeStorage();
      const svc = new AudioService(testDb.db, storage);
      await svc.setConsent(alice, true);
      await svc.uploadUrl(alice, input());
      objects.set(aliceKey(), 1024);

      await svc.confirmUpload(alice, attemptId);
      expect(calls.heads).toEqual([aliceKey()]);
      expect(await storedKey()).toBe(aliceKey());
      expect((await svc.downloadUrl(alice, attemptId)).url).toContain(
        aliceKey(),
      );
      expect(calls.deleted).toEqual([]);
    });

    it("accepts an object of exactly the maximum size", async () => {
      const { storage, calls, objects } = fakeStorage();
      const svc = new AudioService(testDb.db, storage);
      await svc.setConsent(alice, true);
      objects.set(aliceKey(), AUDIO_MAX_BYTES);

      await svc.confirmUpload(alice, attemptId);
      expect(await storedKey()).toBe(aliceKey());
      expect(calls.deleted).toEqual([]);
    });

    it("deletes and rejects an object over the maximum size", async () => {
      const { storage, calls, objects } = fakeStorage();
      const svc = new AudioService(testDb.db, storage);
      await svc.setConsent(alice, true);
      objects.set(aliceKey(), AUDIO_MAX_BYTES + 1);

      await expect(svc.confirmUpload(alice, attemptId)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(calls.deleted).toEqual([aliceKey()]);
      expect(await storedKey()).toBeNull();
    });

    it("rejects a confirmation when nothing was uploaded", async () => {
      const { storage, calls } = fakeStorage();
      const svc = new AudioService(testDb.db, storage);
      await svc.setConsent(alice, true);

      await expect(svc.confirmUpload(alice, attemptId)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(await storedKey()).toBeNull();
      expect(calls.deleted).toEqual([]);
    });

    it("requires consent", async () => {
      const { storage, objects } = fakeStorage();
      const svc = new AudioService(testDb.db, storage);
      objects.set(aliceKey(), 1024);

      await expect(svc.confirmUpload(alice, attemptId)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(await storedKey()).toBeNull();
    });

    it("cannot set the recording of someone else's attempt", async () => {
      const { storage, calls, objects } = fakeStorage();
      const svc = new AudioService(testDb.db, storage);
      await svc.setConsent(bob, true);
      objects.set(aliceKey(), 1024);
      objects.set(`audio/${bob}/${attemptId}`, 1024);

      await expect(svc.confirmUpload(bob, attemptId)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(await storedKey()).toBeNull();
      expect(calls.deleted).toEqual([]);
    });

    it("confirms only the requested attempt", async () => {
      const { storage, objects } = fakeStorage();
      const svc = new AudioService(testDb.db, storage);
      await svc.setConsent(alice, true);
      const other = await attempts.create({
        userId: alice,
        mode: "practice",
        runId: null,
        exerciseId: null,
        task: 3,
        model: "gpt-realtime-mini",
      });
      objects.set(aliceKey(), 1024);

      await svc.confirmUpload(alice, attemptId);
      expect(await storedKey(other.id)).toBeNull();
    });
  });

  it("hides other users' attempts", async () => {
    const { storage } = fakeStorage();
    const svc = new AudioService(testDb.db, storage);
    await svc.setConsent(bob, true);
    await expect(svc.uploadUrl(bob, input())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(svc.downloadUrl(bob, attemptId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("deletes recordings when consent is withdrawn or an attempt is removed", async () => {
    const { storage, calls, objects } = fakeStorage();
    const svc = new AudioService(testDb.db, storage);
    await svc.setConsent(alice, true);
    await svc.uploadUrl(alice, input());
    objects.set(aliceKey(), 2048);
    await svc.confirmUpload(alice, attemptId);

    await svc.deleteForAttempt(alice, attemptId);
    expect(calls.deleted).toEqual([aliceKey()]);

    await svc.setConsent(alice, false);
    expect(calls.prefixes).toEqual([`audio/${alice}/`]);
    expect((await svc.downloadUrl(alice, attemptId)).url).toBeNull();
    expect((await svc.status(alice)).consent).toBe(false);
  });
});
