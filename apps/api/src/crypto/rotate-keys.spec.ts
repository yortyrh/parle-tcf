import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { providerSettings } from "@parle-tcf/db";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { fakeVoiceProvider } from "../test-helpers.js";
import { ProviderSettingsService } from "../settings/provider-settings.service.js";
import { rotateProviderKeys } from "./rotate-keys.js";
import { SecretCipher } from "./secret-cipher.js";

describe("rotateProviderKeys", () => {
  let testDb: TestDb;
  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());

  it("moves rows from v1 to v2 and keeps them decryptable after v1 is retired", async () => {
    const k1 = randomBytes(32).toString("base64");
    const k2 = randomBytes(32).toString("base64");
    const userId = await testDb.createUser();
    const key = "sk-test-rotate-rotate-rotate-rotate-0001";

    const v1 = new SecretCipher(`v1:${k1}`, "v1");
    await new ProviderSettingsService(
      testDb.db,
      v1,
      fakeVoiceProvider(),
    ).upsert(userId, { apiKey: key });

    const both = new SecretCipher(`v1:${k1},v2:${k2}`, "v2");
    expect(await rotateProviderKeys(testDb.db, both)).toEqual({
      scanned: 1,
      rotated: 1,
    });
    expect(await rotateProviderKeys(testDb.db, both)).toEqual({
      scanned: 1,
      rotated: 0,
    });

    const [row] = await testDb.db.select().from(providerSettings);
    expect(row?.keyVersion).toBe("v2");

    const onlyV2 = new SecretCipher(`v2:${k2}`, "v2");
    const settings = new ProviderSettingsService(
      testDb.db,
      onlyV2,
      fakeVoiceProvider(),
    );
    expect((await settings.getConfigForUser(userId)).apiKey).toBe(key);
  });
});
