import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { contentHash, exercises } from "@parle-tcf/db";
import { createTestDb, type TestDb } from "@parle-tcf/db/testing";
import { AttemptsService } from "../attempts/attempts.service.js";
import { ExamConfigService } from "../config/exam-config.service.js";
import { ExerciseService } from "../exercise/exercise.service.js";
import { ProviderError } from "../providers/voice-provider.js";
import { UsageService } from "../usage/usage.service.js";
import { ProviderSettingsService } from "../settings/provider-settings.service.js";
import {
  fakeVoiceProvider,
  registryOf,
  testCipher,
  type FakeVoiceProvider,
} from "../test-helpers.js";
import { ExamSessionService } from "./exam-session.service.js";

const KEY = "sk-test-cccccccccccccccccccccccccccc9999";

const T1_PROMPT =
  "Entretien dirigé : présentation de soi, puis questions sur des sujets quotidiens.";

const FIXTURE_EXERCISES = [
  { id: "x-t2-1", task: 2, prompt: "Jeu de rôle un" },
  { id: "x-t2-2", task: 2, prompt: "Jeu de rôle deux" },
  { id: "x-t3-1", task: 3, prompt: "Sujet de débat" },
  // The fixed tâche 1 row, which the migrations provide and truncateAll() removes.
  { id: "t1-entretien", task: 1, prompt: T1_PROMPT },
];

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
    await testDb.db.insert(exercises).values(
      FIXTURE_EXERCISES.map((e) => ({
        ...e,
        contentHash: contentHash(e.prompt),
        isImageBased: false,
      })),
    );
    voice = fakeVoiceProvider();
    settings = new ProviderSettingsService(
      testDb.db,
      testCipher(),
      registryOf(voice),
    );
    attempts = new AttemptsService(testDb.db);
    service = new ExamSessionService(
      new ExerciseService(testDb.db),
      new ExamConfigService(),
      settings,
      attempts,
      new UsageService(testDb.db),
      registryOf(voice),
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

  it("mints through the Gemini backend with its default model and voice", async () => {
    const gemini = fakeVoiceProvider("gemini");
    const geminiService = new ExamSessionService(
      new ExerciseService(testDb.db),
      new ExamConfigService(),
      settings,
      attempts,
      new UsageService(testDb.db),
      registryOf(voice, gemini),
    );
    await settings.upsert(userId, {
      provider: "gemini",
      apiKey: "AIzaSyTestKey0123456789",
    });
    const out = await geminiService.createSession(userId, {
      taskType: "tache2",
      mode: "practice",
    });
    expect(out.provider).toBe("gemini");
    expect(out.agentConfig.model).toContain("gemini");
    expect(out.agentConfig.voice).toBe("Puck");
    expect(voice.mintCalls).toHaveLength(0);
    expect(gemini.mintCalls).toHaveLength(1);
    expect((await attempts.get(userId, out.attemptId)).model).toContain(
      "gemini",
    );
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
  it("adds image, scenario and instruction to the exercise data only when set", async () => {
    await settings.upsert(userId, { apiKey: KEY });
    await testDb.db.insert(exercises).values([
      {
        id: "x-t2-rich",
        task: 2,
        prompt: "Je suis guide. Vous me demandez le programme.",
        contentHash: contentHash(
          "Je suis guide. Vous me demandez le programme.",
        ),
        scenario: "Je suis guide.",
        instruction: "Vous me demandez le programme.",
        isImageBased: false,
      },
      {
        id: "x-t3-img",
        task: 3,
        prompt: "Décrivez cette image.",
        contentHash: contentHash("Décrivez cette image."),
        imageUrl: "https://img.test/a.png",
        isImageBased: true,
      },
    ]);

    const rich = await service.createSession(userId, {
      taskType: "tache2",
      exerciseId: "x-t2-rich",
      mode: "practice",
    });
    expect(rich.exerciseData).toMatchObject({
      exerciseId: "x-t2-rich",
      content: "Je suis guide. Vous me demandez le programme.",
      scenario: "Je suis guide.",
      instruction: "Vous me demandez le programme.",
    });
    expect(rich.exerciseData).not.toHaveProperty("imageUrl");

    const img = await service.createSession(userId, {
      taskType: "tache3",
      exerciseId: "x-t3-img",
      mode: "practice",
    });
    expect(img.exerciseData).toMatchObject({
      exerciseId: "x-t3-img",
      imageUrl: "https://img.test/a.png",
    });
    expect(img.exerciseData).not.toHaveProperty("scenario");
    expect(img.exerciseData).not.toHaveProperty("instruction");

    const plain = await service.createSession(userId, {
      taskType: "tache2",
      exerciseId: "x-t2-2",
      mode: "practice",
    });
    for (const key of ["imageUrl", "scenario", "instruction"]) {
      expect(plain.exerciseData).not.toHaveProperty(key);
    }

    const t1 = await service.createSession(userId, {
      taskType: "tache1",
      mode: "practice",
    });
    for (const key of ["imageUrl", "scenario", "instruction"]) {
      expect(t1.exerciseData).not.toHaveProperty(key);
    }
  });
});
