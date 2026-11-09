import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parseExerciseCsv, seedExercises } from "@parle-tcf/db";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { AttemptsService } from "../attempts/attempts.service.js";
import { ExamConfigService } from "../config/exam-config.service.js";
import { ExerciseService } from "../exercise/exercise.service.js";
import { ProviderError } from "../providers/voice-provider.js";
import { UsageService } from "../usage/usage.service.js";
import { ProviderSettingsService } from "../settings/provider-settings.service.js";
import {
  fakeVoiceProvider,
  testCipher,
  type FakeVoiceProvider,
} from "../test-helpers.js";
import { ExamSessionService } from "./exam-session.service.js";

const KEY = "sk-test-cccccccccccccccccccccccccccc9999";

const CSV = `id,taskType,content,url,imageUrl,imagePath,isImageBased
x-t2-1,Tâche 2,Jeu de rôle un,,,,FALSE
x-t2-2,Tâche 2,Jeu de rôle deux,,,,FALSE
x-t3-1,Tâche 3,Sujet de débat,,,,FALSE
`;

describe("ExamSessionService", () => {
  let testDb: TestDb;
  let voice: FakeVoiceProvider;
  let settings: ProviderSettingsService;
  let attempts: AttemptsService;
  let service: ExamSessionService;
  let userId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
    await seedExercises(testDb.db, parseExerciseCsv(CSV));
    voice = fakeVoiceProvider();
    settings = new ProviderSettingsService(testDb.db, testCipher(), voice);
    attempts = new AttemptsService(testDb.db);
    service = new ExamSessionService(
      new ExerciseService(testDb.db),
      new ExamConfigService(),
      settings,
      attempts,
      new UsageService(testDb.db),
      voice,
    );
    userId = await testDb.createUser();
  });

  it("fails with PROVIDER_NOT_CONFIGURED before touching the provider", async () => {
    await expect(
      service.createSession(userId, { taskType: "tache2", mode: "practice" }),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED", status: 412 });
    expect(voice.mintCalls).toHaveLength(0);
    expect((await attempts.list(userId, {})).total).toBe(0);
  });

  it("mints with the user's own key and records an attempt", async () => {
    await settings.upsert(userId, { apiKey: KEY, voice: "marin" });

    const out = await service.createSession(userId, {
      taskType: "tache2",
      exerciseId: "x-t2-2",
      mode: "practice",
    });

    expect(voice.mintCalls).toHaveLength(1);
    expect(voice.mintCalls[0]?.apiKey).toBe(KEY);
    expect(voice.mintCalls[0]?.params.voice).toBe("marin");
    expect(out.clientSecret).toBe("ek_test_ephemeral");
    expect(out.exerciseData.exerciseId).toBe("x-t2-2");
    expect(out.orderedExerciseIds).toEqual(["x-t2-1", "x-t2-2"]);
    expect(out.runId).toBeNull();
    // The upstream key must not leak into anything returned to the browser.
    expect(JSON.stringify(out)).not.toContain(KEY);

    const detail = await attempts.get(userId, out.attemptId);
    expect(detail).toMatchObject({
      task: 2,
      exerciseId: "x-t2-2",
      status: "in_progress",
    });
  });

  it("refuses to start once the daily minutes limit is reached", async () => {
    await settings.upsert(userId, { apiKey: KEY });
    const first = await service.createSession(userId, {
      taskType: "tache2",
      mode: "practice",
    });
    await attempts.complete(userId, {
      attemptId: first.attemptId,
      lines: [],
      durationS: 61 * 60,
    });
    await expect(
      service.createSession(userId, { taskType: "tache2", mode: "practice" }),
    ).rejects.toMatchObject({ code: "LIMIT_REACHED", status: 429 });
  });

  it("serves tâche 1 with its fixed interview row", async () => {
    await settings.upsert(userId, { apiKey: KEY });
    const out = await service.createSession(userId, {
      taskType: "tache1",
      mode: "practice",
    });
    expect(out.orderedExerciseIds).toEqual([]);
    expect(out.agentConfig.instructions).toContain("BANQUE DE QUESTIONS");
    expect((await attempts.get(userId, out.attemptId)).exerciseId).toBe(
      "t1-entretien",
    );
  });

  it("rejects an unknown exercise or one from another task", async () => {
    await settings.upsert(userId, { apiKey: KEY });
    await expect(
      service.createSession(userId, {
        taskType: "tache2",
        exerciseId: "nope",
        mode: "practice",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.createSession(userId, {
        taskType: "tache3",
        exerciseId: "x-t2-1",
        mode: "practice",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(voice.mintCalls).toHaveLength(0);
  });

  it("maps a rejected key to PROVIDER_KEY_REJECTED without creating an attempt", async () => {
    await settings.upsert(userId, { apiKey: KEY });
    voice.mintError = new ProviderError("Clé API refusée par OpenAI", 401);
    await expect(
      service.createSession(userId, { taskType: "tache3", mode: "practice" }),
    ).rejects.toMatchObject({ code: "PROVIDER_KEY_REJECTED", status: 422 });
    expect((await attempts.list(userId, {})).total).toBe(0);
  });
});
