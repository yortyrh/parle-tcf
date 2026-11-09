import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { providerSettings } from "@parle-tcf/db";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import {
  fakeVoiceProvider,
  registryOf,
  testCipher,
  type FakeVoiceProvider,
} from "../test-helpers.js";
import { ProviderSettingsService } from "./provider-settings.service.js";

const KEY_A = "sk-test-aaaaaaaaaaaaaaaaaaaaaaaaaaaaWXYZ";
const KEY_B = "sk-test-bbbbbbbbbbbbbbbbbbbbbbbbbbbb1234";

describe("ProviderSettingsService", () => {
  let testDb: TestDb;
  let voice: FakeVoiceProvider;
  let service: ProviderSettingsService;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
    voice = fakeVoiceProvider();
    service = new ProviderSettingsService(
      testDb.db,
      testCipher(),
      registryOf(voice),
    );
    alice = await testDb.createUser();
    bob = await testDb.createUser();
  });

  it("reports an unconfigured user without leaking anything", async () => {
    expect(await service.get(alice)).toMatchObject({
      configured: false,
      last4: null,
    });
    await expect(service.getConfigForUser(alice)).rejects.toMatchObject({
      code: "PROVIDER_NOT_CONFIGURED",
    });
  });

  it("stores the key encrypted and never returns it", async () => {
    const dto = await service.upsert(alice, { apiKey: KEY_A });
    expect(JSON.stringify(dto)).not.toContain(KEY_A);
    expect(dto).toMatchObject({ configured: true, last4: "WXYZ" });

    const [row] = await testDb.db.select().from(providerSettings);
    expect(JSON.stringify(row)).not.toContain(KEY_A);
    expect(row?.keyVersion).toBe("v1");

    expect((await service.getConfigForUser(alice)).apiKey).toBe(KEY_A);
  });

  it("keeps the stored key when only models change, and resets verification on a new key", async () => {
    await service.upsert(alice, { apiKey: KEY_A });
    await service.test(alice);
    expect((await service.get(alice)).verifiedAt).not.toBeNull();

    const updated = await service.upsert(alice, {
      voice: "marin",
      realtimeModel: "gpt-realtime",
    });
    expect(updated).toMatchObject({
      voice: "marin",
      realtimeModel: "gpt-realtime",
    });
    expect(updated.verifiedAt).not.toBeNull();
    expect((await service.getConfigForUser(alice)).apiKey).toBe(KEY_A);

    const replaced = await service.upsert(alice, { apiKey: KEY_B });
    expect(replaced.last4).toBe("1234");
    expect(replaced.verifiedAt).toBeNull();
  });

  it("requires a key on first configuration", async () => {
    await expect(
      service.upsert(alice, { voice: "marin" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("isolates users and deletes only the caller's settings", async () => {
    await service.upsert(alice, { apiKey: KEY_A });
    await service.upsert(bob, { apiKey: KEY_B });
    expect((await service.getConfigForUser(bob)).apiKey).toBe(KEY_B);

    await service.delete(alice);
    expect((await service.get(alice)).configured).toBe(false);
    expect((await service.get(bob)).configured).toBe(true);
  });

  it("test() records verification only when the provider accepts the key", async () => {
    await service.upsert(alice, { apiKey: KEY_A });
    voice.verifyResult = { ok: false, message: "Clé refusée" };
    expect(await service.test(alice)).toEqual({
      ok: false,
      message: "Clé refusée",
    });
    expect((await service.get(alice)).verifiedAt).toBeNull();

    voice.verifyResult = { ok: true };
    expect(await service.test(alice)).toEqual({ ok: true });
    expect((await service.get(alice)).verifiedAt).not.toBeNull();
  });

  it("requires a new key when the provider changes", async () => {
    const user = await testDb.createUser("switch@test.local");
    await service.upsert(user, { apiKey: "sk-test-0123456789abcdef" });
    await expect(
      service.upsert(user, { provider: "gemini", voice: "Puck" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const saved = await service.upsert(user, {
      provider: "gemini",
      apiKey: "AIzaSyTestKey0123456789",
    });
    expect(saved.provider).toBe("gemini");
  });
});
