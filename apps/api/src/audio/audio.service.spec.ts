import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { AttemptsService } from "../attempts/attempts.service.js";
import type { AudioStorage } from "./audio-storage.js";
import { AudioService } from "./audio.service.js";

function fakeStorage() {
  const calls = { deleted: [] as string[], prefixes: [] as string[] };
  const storage: AudioStorage = {
    presignUpload: async (key, type) => `https://s3.test/put/${key}?t=${type}`,
    presignDownload: async (key) => `https://s3.test/get/${key}`,
    delete: async (key) => void calls.deleted.push(key),
    deletePrefix: async (p) => void calls.prefixes.push(p),
  };
  return { storage, calls };
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

  it("is unavailable without storage", async () => {
    const svc = new AudioService(testDb.db, null);
    expect(await svc.status(alice)).toEqual({
      available: false,
      consent: false,
    });
    await expect(svc.uploadUrl(alice, input())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("refuses uploads without explicit consent", async () => {
    const { storage } = fakeStorage();
    const svc = new AudioService(testDb.db, storage);
    await expect(svc.uploadUrl(alice, input())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("signs an upload under the user's prefix once consent is given", async () => {
    const { storage } = fakeStorage();
    const svc = new AudioService(testDb.db, storage);
    await svc.setConsent(alice, true);
    const out = await svc.uploadUrl(alice, input());
    expect(out.url).toContain(`audio/${alice}/${attemptId}`);
    expect((await svc.downloadUrl(alice, attemptId)).url).toContain(attemptId);
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
    const { storage, calls } = fakeStorage();
    const svc = new AudioService(testDb.db, storage);
    await svc.setConsent(alice, true);
    await svc.uploadUrl(alice, input());

    await svc.deleteForAttempt(alice, attemptId);
    expect(calls.deleted).toEqual([`audio/${alice}/${attemptId}`]);

    await svc.setConsent(alice, false);
    expect(calls.prefixes).toEqual([`audio/${alice}/`]);
    expect((await svc.downloadUrl(alice, attemptId)).url).toBeNull();
    expect((await svc.status(alice)).consent).toBe(false);
  });
});
