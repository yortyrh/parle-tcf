import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentHash, eq, examAttempts, exercises } from '@parle-tcf/db';
import { type TestDb, createTestDb } from '@parle-tcf/db/testing';
import { AttemptsService } from '../attempts/attempts.service.js';
import { ExamConfigService } from '../config/exam-config.service.js';
import { ExerciseService } from '../exercise/exercise.service.js';
import { ProviderError } from '../providers/voice-provider.js';
import { ProviderSettingsService } from '../settings/provider-settings.service.js';
import {
  type FakeVoiceProvider,
  fakeVoiceProvider,
  registryOf,
  testCipher,
} from '../test-helpers.js';
import { UsageService } from '../usage/usage.service.js';
import { DEFAULT_GEMINI_LIVE_MODEL, ExamSessionService } from './exam-session.service.js';

const KEY = 'sk-test-cccccccccccccccccccccccccccc9999';

const T1_PROMPT =
  'Entretien dirigé : présentation de soi, puis questions sur des sujets quotidiens.';

const FIXTURE_EXERCISES = [
  { id: 'x-t2-1', task: 2, prompt: 'Jeu de rôle un' },
  { id: 'x-t2-2', task: 2, prompt: 'Jeu de rôle deux' },
  { id: 'x-t3-1', task: 3, prompt: 'Sujet de débat' },
  // The fixed tâche 1 row, which the migrations provide and truncateAll() removes.
  { id: 't1-entretien', task: 1, prompt: T1_PROMPT },
];

/** Real agent YAMLs, a custom service.yml `llm`, and no info markdown. */
class StubConfig extends ExamConfigService {
  constructor(private readonly llm: { model: string; voice: string }) {
    super();
  }
  override loadServiceConfig() {
    return { llm: this.llm };
  }
  override loadInfoMarkdown(): string | undefined {
    return undefined;
  }
}

describe('ExamSessionService', () => {
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
      }))
    );
    voice = fakeVoiceProvider();
    settings = new ProviderSettingsService(testDb.db, testCipher(), registryOf(voice));
    attempts = new AttemptsService(testDb.db);
    service = new ExamSessionService(
      new ExerciseService(testDb.db),
      new ExamConfigService(),
      settings,
      attempts,
      new UsageService(testDb.db),
      registryOf(voice)
    );
    userId = await testDb.createUser();
  });

  it('fails with PROVIDER_NOT_CONFIGURED before touching the provider', async () => {
    await expect(
      service.createSession(userId, { taskType: 'tache2', mode: 'practice' })
    ).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED', status: 412 });
    expect(voice.mintCalls).toHaveLength(0);
    expect((await attempts.list(userId, {})).total).toBe(0);
  });

  it("mints with the user's own key and records an attempt", async () => {
    await settings.upsert(userId, { apiKey: KEY, voice: 'marin' });

    const out = await service.createSession(userId, {
      taskType: 'tache2',
      exerciseId: 'x-t2-2',
      mode: 'practice',
    });

    expect(voice.mintCalls).toHaveLength(1);
    expect(voice.mintCalls[0]?.apiKey).toBe(KEY);
    expect(voice.mintCalls[0]?.params.voice).toBe('marin');
    expect(out.clientSecret).toBe('ek_test_ephemeral');
    expect(out.exerciseData.exerciseId).toBe('x-t2-2');
    expect(out.orderedExerciseIds).toEqual(['x-t2-1', 'x-t2-2']);
    expect(out.runId).toBeNull();
    // The upstream key must not leak into anything returned to the browser.
    expect(JSON.stringify(out)).not.toContain(KEY);

    const detail = await attempts.get(userId, out.attemptId);
    expect(detail).toMatchObject({
      task: 2,
      exerciseId: 'x-t2-2',
      status: 'in_progress',
    });
  });

  it('refuses to start once the daily minutes limit is reached', async () => {
    await settings.upsert(userId, { apiKey: KEY });
    const first = await service.createSession(userId, {
      taskType: 'tache2',
      mode: 'practice',
    });
    await attempts.complete(userId, { attemptId: first.attemptId, lines: [] });
    // The server computes the duration; store a full hour of usage directly.
    await testDb.db
      .update(examAttempts)
      .set({ realtimeMinutes: '61.00' })
      .where(eq(examAttempts.id, first.attemptId));
    await expect(
      service.createSession(userId, { taskType: 'tache2', mode: 'practice' })
    ).rejects.toMatchObject({ code: 'LIMIT_REACHED', status: 429 });
  });

  it('mints through the Gemini backend with its default model and voice', async () => {
    const gemini = fakeVoiceProvider('gemini');
    const geminiService = new ExamSessionService(
      new ExerciseService(testDb.db),
      new ExamConfigService(),
      settings,
      attempts,
      new UsageService(testDb.db),
      registryOf(voice, gemini)
    );
    await settings.upsert(userId, {
      provider: 'gemini',
      apiKey: 'AIzaSyTestKey0123456789',
    });
    const out = await geminiService.createSession(userId, {
      taskType: 'tache2',
      mode: 'practice',
    });
    expect(out.provider).toBe('gemini');
    expect(out.agentConfig.model).toContain('gemini');
    expect(out.agentConfig.voice).toBe('Puck');
    expect(voice.mintCalls).toHaveLength(0);
    expect(gemini.mintCalls).toHaveLength(1);
    expect((await attempts.get(userId, out.attemptId)).model).toContain('gemini');
  });

  it('serves tâche 1 with its fixed interview row', async () => {
    await settings.upsert(userId, { apiKey: KEY });
    const out = await service.createSession(userId, {
      taskType: 'tache1',
      mode: 'practice',
    });
    expect(out.orderedExerciseIds).toEqual([]);
    expect(out.agentConfig.instructions).toContain('BANQUE DE QUESTIONS');
    expect((await attempts.get(userId, out.attemptId)).exerciseId).toBe('t1-entretien');
  });

  it('rejects an unknown exercise or one from another task', async () => {
    await settings.upsert(userId, { apiKey: KEY });
    await expect(
      service.createSession(userId, {
        taskType: 'tache2',
        exerciseId: 'nope',
        mode: 'practice',
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.createSession(userId, {
        taskType: 'tache3',
        exerciseId: 'x-t2-1',
        mode: 'practice',
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(voice.mintCalls).toHaveLength(0);
  });

  it('maps a rejected key to PROVIDER_KEY_REJECTED without creating an attempt', async () => {
    await settings.upsert(userId, { apiKey: KEY });
    voice.mintError = new ProviderError('Clé API refusée par OpenAI', 401);
    await expect(
      service.createSession(userId, { taskType: 'tache3', mode: 'practice' })
    ).rejects.toMatchObject({ code: 'PROVIDER_KEY_REJECTED', status: 422 });
    expect((await attempts.list(userId, {})).total).toBe(0);
  });
  it('adds image, scenario and instruction to the exercise data only when set', async () => {
    await settings.upsert(userId, { apiKey: KEY });
    await testDb.db.insert(exercises).values([
      {
        id: 'x-t2-rich',
        task: 2,
        prompt: 'Je suis guide. Vous me demandez le programme.',
        contentHash: contentHash('Je suis guide. Vous me demandez le programme.'),
        scenario: 'Je suis guide.',
        instruction: 'Vous me demandez le programme.',
        isImageBased: false,
      },
      {
        id: 'x-t3-img',
        task: 3,
        prompt: 'Décrivez cette image.',
        contentHash: contentHash('Décrivez cette image.'),
        imageUrl: 'https://img.test/a.png',
        isImageBased: true,
      },
    ]);

    const rich = await service.createSession(userId, {
      taskType: 'tache2',
      exerciseId: 'x-t2-rich',
      mode: 'practice',
    });
    expect(rich.exerciseData).toMatchObject({
      exerciseId: 'x-t2-rich',
      content: 'Je suis guide. Vous me demandez le programme.',
      scenario: 'Je suis guide.',
      instruction: 'Vous me demandez le programme.',
    });
    expect(rich.exerciseData).not.toHaveProperty('imageUrl');

    const img = await service.createSession(userId, {
      taskType: 'tache3',
      exerciseId: 'x-t3-img',
      mode: 'practice',
    });
    expect(img.exerciseData).toMatchObject({
      exerciseId: 'x-t3-img',
      imageUrl: 'https://img.test/a.png',
    });
    expect(img.exerciseData).not.toHaveProperty('scenario');
    expect(img.exerciseData).not.toHaveProperty('instruction');

    const plain = await service.createSession(userId, {
      taskType: 'tache2',
      exerciseId: 'x-t2-2',
      mode: 'practice',
    });
    for (const key of ['imageUrl', 'scenario', 'instruction']) {
      expect(plain.exerciseData).not.toHaveProperty(key);
    }

    const t1 = await service.createSession(userId, {
      taskType: 'tache1',
      mode: 'practice',
    });
    for (const key of ['imageUrl', 'scenario', 'instruction']) {
      expect(t1.exerciseData).not.toHaveProperty(key);
    }
  });
  describe('model and voice resolution', () => {
    beforeEach(() => {
      vi.stubEnv('OPENAI_REALTIME_MODEL', undefined);
      vi.stubEnv('GEMINI_LIVE_MODEL', undefined);
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    const withServiceModel = (model: string) =>
      new ExamSessionService(
        new ExerciseService(testDb.db),
        new StubConfig({ model, voice: 'alloy' }),
        settings,
        attempts,
        new UsageService(testDb.db),
        registryOf(voice)
      );

    it('defaults OpenAI to gpt-realtime-mini and the service voice', async () => {
      await settings.upsert(userId, { apiKey: KEY });
      const out = await service.createSession(userId, { taskType: 'tache2', mode: 'practice' });
      expect(out.agentConfig.model).toBe('gpt-realtime-mini');
      expect(out.agentConfig.voice).toBe('alloy');
      expect(voice.mintCalls[0]?.params).toEqual({ model: 'gpt-realtime-mini', voice: 'alloy' });
      expect((await attempts.get(userId, out.attemptId)).model).toBe('gpt-realtime-mini');
    });

    it('takes the OpenAI default from OPENAI_REALTIME_MODEL', async () => {
      vi.stubEnv('OPENAI_REALTIME_MODEL', 'gpt-realtime-env');
      await settings.upsert(userId, { apiKey: KEY });
      const out = await service.createSession(userId, { taskType: 'tache2', mode: 'practice' });
      expect(out.agentConfig.model).toBe('gpt-realtime-env');
    });

    it("prefers the user's realtime model over every default", async () => {
      vi.stubEnv('OPENAI_REALTIME_MODEL', 'gpt-realtime-env');
      await settings.upsert(userId, { apiKey: KEY, realtimeModel: 'gpt-realtime' });
      const out = await withServiceModel('gpt-realtime-service').createSession(userId, {
        taskType: 'tache2',
        mode: 'practice',
      });
      expect(out.agentConfig.model).toBe('gpt-realtime');
      expect(voice.mintCalls[0]?.params.model).toBe('gpt-realtime');
    });

    it('uses a concrete service.yml model before the env default', async () => {
      vi.stubEnv('OPENAI_REALTIME_MODEL', 'gpt-realtime-env');
      await settings.upsert(userId, { apiKey: KEY });
      const out = await withServiceModel('gpt-realtime-service').createSession(userId, {
        taskType: 'tache2',
        mode: 'practice',
      });
      expect(out.agentConfig.model).toBe('gpt-realtime-service');
    });

    it('treats an empty service.yml model like "realtime"', async () => {
      await settings.upsert(userId, { apiKey: KEY });
      const out = await withServiceModel('').createSession(userId, {
        taskType: 'tache2',
        mode: 'practice',
      });
      expect(out.agentConfig.model).toBe('gpt-realtime-mini');
    });

    it('takes the Gemini default from GEMINI_LIVE_MODEL, then the built-in one', async () => {
      const gemini = fakeVoiceProvider('gemini');
      const geminiService = new ExamSessionService(
        new ExerciseService(testDb.db),
        new StubConfig({ model: 'gpt-realtime-service', voice: 'alloy' }),
        settings,
        attempts,
        new UsageService(testDb.db),
        registryOf(voice, gemini)
      );
      await settings.upsert(userId, { provider: 'gemini', apiKey: 'AIzaSyTestKey0123456789' });

      const builtIn = await geminiService.createSession(userId, {
        taskType: 'tache2',
        mode: 'practice',
      });
      expect(builtIn.agentConfig.model).toBe(DEFAULT_GEMINI_LIVE_MODEL);

      vi.stubEnv('GEMINI_LIVE_MODEL', 'gemini-env-model');
      const fromEnv = await geminiService.createSession(userId, {
        taskType: 'tache2',
        mode: 'practice',
      });
      expect(fromEnv.agentConfig.model).toBe('gemini-env-model');
    });

    it("keeps the user's own voice for Gemini", async () => {
      const gemini = fakeVoiceProvider('gemini');
      const geminiService = new ExamSessionService(
        new ExerciseService(testDb.db),
        new ExamConfigService(),
        settings,
        attempts,
        new UsageService(testDb.db),
        registryOf(voice, gemini)
      );
      await settings.upsert(userId, {
        provider: 'gemini',
        apiKey: 'AIzaSyTestKey0123456789',
        voice: 'Kore',
      });
      const out = await geminiService.createSession(userId, {
        taskType: 'tache2',
        mode: 'practice',
      });
      expect(out.agentConfig.voice).toBe('Kore');
      expect(gemini.mintCalls[0]?.params.voice).toBe('Kore');
    });
  });

  describe('exercise data and instructions', () => {
    const agent = (task: 'tache1' | 'tache2' | 'tache3') =>
      new ExamConfigService().loadAgentConfig(task);
    const base = (task: 'tache1' | 'tache2' | 'tache3') =>
      `${agent(task).baseInstructions}\n\n${agent(task).instructions}`;

    it('builds tâche 2 from the chosen subject', async () => {
      await settings.upsert(userId, { apiKey: KEY });
      const out = await service.createSession(userId, {
        taskType: 'tache2',
        exerciseId: 'x-t2-1',
        mode: 'practice',
      });
      expect(out.exerciseData).toEqual({
        title: 'Tâche 2 - Exercice en interaction',
        description: 'Jeu de rôle un',
        content: 'Jeu de rôle un',
        exerciseId: 'x-t2-1',
        taskType: 'tache2',
      });
      expect(out.agentConfig).toEqual({
        instructions: `${base('tache2')}\n\nEXERCICE À UTILISER:\nJeu de rôle un`,
        greeting: agent('tache2').greeting,
        voice: 'alloy',
        model: 'gpt-realtime-mini',
        allowInterruptions: agent('tache2').settings.allowInterruptions,
      });
      expect(out.provider).toBe('openai');
      expect(out.attemptId).toMatch(/^[0-9a-f-]{36}$/);
      expect(out.sessionId).toMatch(/^[0-9a-f-]{36}$/);
      expect(out.sessionId).not.toBe(out.attemptId);
    });

    it('builds tâche 3 from the chosen subject', async () => {
      await settings.upsert(userId, { apiKey: KEY });
      const out = await service.createSession(userId, {
        taskType: 'tache3',
        exerciseId: 'x-t3-1',
        mode: 'practice',
      });
      expect(out.exerciseData).toEqual({
        title: "Tâche 3 - Expression d'un point de vue",
        description: 'Sujet de débat',
        content: 'Sujet de débat',
        exerciseId: 'x-t3-1',
        taskType: 'tache3',
      });
      expect(out.agentConfig.instructions).toBe(
        `${base('tache3')}\n\nEXERCICE À UTILISER:\nSujet de débat`
      );
      expect(out.agentConfig.greeting).toBe(agent('tache3').greeting);
    });

    it('builds tâche 1 with the reference question bank', async () => {
      await settings.upsert(userId, { apiKey: KEY });
      const bank = new ExamConfigService().loadInfoMarkdown('questions-tache1-entretien.md');
      expect(bank).toBeTruthy();
      const out = await service.createSession(userId, { taskType: 'tache1', mode: 'practice' });
      expect(out.exerciseData).toEqual({
        title: 'Tâche 1 - Entretien dirigé',
        description:
          'Présentation de soi, puis un entretien dirigé, exercice de conversation sur des sujets quotidiens',
        content: '',
        taskType: 'tache1',
      });
      expect(out.agentConfig.instructions).toBe(
        `${base('tache1')}\n\nBANQUE DE QUESTIONS DE RÉFÉRENCE (à puiser, à varier, à ne JAMAIS lire ni énumérer au candidat):\n${bank}`
      );
      expect(out.agentConfig.instructions).not.toContain(T1_PROMPT);
    });

    it('leaves tâche 1 instructions bare when the question bank is missing', async () => {
      await settings.upsert(userId, { apiKey: KEY });
      const noBank = new ExamSessionService(
        new ExerciseService(testDb.db),
        new StubConfig({ model: 'realtime', voice: 'alloy' }),
        settings,
        attempts,
        new UsageService(testDb.db),
        registryOf(voice)
      );
      const out = await noBank.createSession(userId, { taskType: 'tache1', mode: 'practice' });
      expect(out.agentConfig.instructions).toBe(base('tache1'));
    });

    it.each([
      [
        'tache2',
        'Tâche 2 - Exercice en interaction',
        'Jeu de rôle — obtenir des informations sur une situation quotidienne',
      ],
      [
        'tache3',
        "Tâche 3 - Expression d'un point de vue",
        "Présentation d'un sujet, souvent lié à la vie quotidienne ou des débats de société",
      ],
    ] as const)(
      'falls back to a generic %s when the bank has no subject',
      async (taskType, title, description) => {
        await testDb.db.delete(exercises);
        await settings.upsert(userId, { apiKey: KEY });
        const out = await service.createSession(userId, { taskType, mode: 'practice' });
        expect(out.exerciseData).toEqual({
          title,
          description,
          content: '',
          exerciseId: undefined,
          taskType,
        });
        expect(out.agentConfig.instructions).toBe(base(taskType));
        expect(out.orderedExerciseIds).toEqual([]);
        expect((await attempts.get(userId, out.attemptId)).exerciseId).toBeNull();
      }
    );

    it('serves tâche 1 without its fixed row', async () => {
      await testDb.db.delete(exercises);
      await settings.upsert(userId, { apiKey: KEY });
      const out = await service.createSession(userId, { taskType: 'tache1', mode: 'practice' });
      expect(out.exerciseData.exerciseId).toBeUndefined();
      expect((await attempts.get(userId, out.attemptId)).exerciseId).toBeNull();
    });

    it('says which exercise was not found', async () => {
      await settings.upsert(userId, { apiKey: KEY });
      await expect(
        service.createSession(userId, { taskType: 'tache2', exerciseId: 'nope', mode: 'practice' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Exercice introuvable.' });
    });

    it('chains a full run through the given runId', async () => {
      await settings.upsert(userId, { apiKey: KEY });
      const first = await service.createSession(userId, { taskType: 'tache1', mode: 'full' });
      expect(first.runId).toEqual(expect.any(String));
      const second = await service.createSession(userId, {
        taskType: 'tache2',
        mode: 'full',
        runId: first.runId ?? undefined,
      });
      expect(second.runId).toBe(first.runId);
      expect((await attempts.get(userId, second.attemptId)).runId).toBe(first.runId);
    });
  });

  it('rethrows non-provider mint failures unchanged', async () => {
    await settings.upsert(userId, { apiKey: KEY });
    const boom = new Error('socket hang up');
    voice.mintError = boom;
    await expect(
      service.createSession(userId, { taskType: 'tache2', mode: 'practice' })
    ).rejects.toBe(boom);
  });

  describe('refreshToken', () => {
    const rowOf = async (id: string) => {
      const [row] = await testDb.db.select().from(examAttempts).where(eq(examAttempts.id, id));
      return row;
    };
    const hourAgo = () => new Date(Date.now() - 3600_000);

    /** A live session of `userId` whose clock was set an hour back. */
    const liveSession = async () => {
      await settings.upsert(userId, { apiKey: KEY, voice: 'marin' });
      const out = await service.createSession(userId, {
        taskType: 'tache2',
        mode: 'practice',
      });
      await testDb.db
        .update(examAttempts)
        .set({ startedAt: hourAgo(), lastActivityAt: hourAgo() })
        .where(eq(examAttempts.id, out.attemptId));
      return out;
    };

    it("mints a new secret for the attempt's model and restarts its clock", async () => {
      const out = await liveSession();
      const before = Date.now();

      expect(await service.refreshToken(userId, { attemptId: out.attemptId })).toEqual({
        clientSecret: 'ek_test_ephemeral',
      });

      expect(voice.mintCalls).toHaveLength(2);
      expect(voice.mintCalls[1]?.apiKey).toBe(KEY);
      expect(voice.mintCalls[1]?.params).toEqual(voice.mintCalls[0]?.params);
      expect(voice.mintCalls[1]?.params.model).toBe(out.agentConfig.model);
      expect(voice.mintCalls[1]?.params.voice).toBe('marin');

      const row = await rowOf(out.attemptId);
      expect(row.startedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(row.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(row.status).toBe('in_progress');
    });

    it('uses the model stored on the attempt, not the current settings', async () => {
      const out = await liveSession();
      await settings.upsert(userId, {
        apiKey: KEY,
        realtimeModel: 'gpt-realtime',
      });
      await service.refreshToken(userId, { attemptId: out.attemptId });
      expect(voice.mintCalls[1]?.params.model).toBe(out.agentConfig.model);
    });

    it("refuses another user's attempt", async () => {
      const out = await liveSession();
      const other = await testDb.createUser('other@test.local');
      await settings.upsert(other, { apiKey: KEY });

      await expect(service.refreshToken(other, { attemptId: out.attemptId })).rejects.toMatchObject(
        { code: 'NOT_FOUND' }
      );
      expect(voice.mintCalls).toHaveLength(1);
      expect((await rowOf(out.attemptId)).startedAt.getTime()).toBeLessThan(
        Date.now() - 30 * 60_000
      );
    });

    it('refuses an unknown attempt', async () => {
      await settings.upsert(userId, { apiKey: KEY });
      await expect(
        service.refreshToken(userId, {
          attemptId: '00000000-0000-4000-8000-000000000000',
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(voice.mintCalls).toHaveLength(0);
    });

    it.each(['completed', 'interrupted'] as const)(
      'refuses a %s attempt with CONFLICT',
      async (status) => {
        const out = await liveSession();
        await testDb.db
          .update(examAttempts)
          .set({ status })
          .where(eq(examAttempts.id, out.attemptId));

        await expect(
          service.refreshToken(userId, { attemptId: out.attemptId })
        ).rejects.toMatchObject({
          code: 'CONFLICT',
          message: 'Cette tentative est déjà terminée.',
        });
        expect(voice.mintCalls).toHaveLength(1);
      }
    );

    it('refuses with CONFLICT when the user switched provider', async () => {
      const gemini = fakeVoiceProvider('gemini');
      const both = new ExamSessionService(
        new ExerciseService(testDb.db),
        new ExamConfigService(),
        settings,
        attempts,
        new UsageService(testDb.db),
        registryOf(voice, gemini)
      );
      await settings.upsert(userId, { apiKey: KEY });
      const out = await both.createSession(userId, {
        taskType: 'tache2',
        mode: 'practice',
      });
      await settings.upsert(userId, {
        provider: 'gemini',
        apiKey: 'AIzaSyTestKey0123456789',
      });

      await expect(both.refreshToken(userId, { attemptId: out.attemptId })).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'Le fournisseur a changé depuis le début de la tâche. Relancez la tâche.',
      });
      expect(voice.mintCalls).toHaveLength(1);
      expect(gemini.mintCalls).toHaveLength(0);
    });

    it('refreshes a Gemini session with the Gemini voice rule', async () => {
      const gemini = fakeVoiceProvider('gemini');
      const geminiService = new ExamSessionService(
        new ExerciseService(testDb.db),
        new ExamConfigService(),
        settings,
        attempts,
        new UsageService(testDb.db),
        registryOf(voice, gemini)
      );
      await settings.upsert(userId, {
        provider: 'gemini',
        apiKey: 'AIzaSyTestKey0123456789',
      });
      const out = await geminiService.createSession(userId, {
        taskType: 'tache2',
        mode: 'practice',
      });

      await geminiService.refreshToken(userId, { attemptId: out.attemptId });
      expect(gemini.mintCalls).toHaveLength(2);
      expect(gemini.mintCalls[1]?.params).toEqual({
        model: out.agentConfig.model,
        voice: 'Puck',
      });
      expect(voice.mintCalls).toHaveLength(0);
    });

    it('refuses once the daily limit is reached, without touching the attempt', async () => {
      const out = await liveSession();
      const used = await attempts.create({
        userId,
        mode: 'practice',
        runId: null,
        exerciseId: null,
        task: 3,
        model: 'gpt-realtime-mini',
      });
      await testDb.db
        .update(examAttempts)
        .set({ status: 'completed', realtimeMinutes: '61.00' })
        .where(eq(examAttempts.id, used.id));
      const startedBefore = (await rowOf(out.attemptId)).startedAt.getTime();

      await expect(
        service.refreshToken(userId, { attemptId: out.attemptId })
      ).rejects.toMatchObject({ code: 'LIMIT_REACHED', status: 429 });
      expect(voice.mintCalls).toHaveLength(1);
      expect((await rowOf(out.attemptId)).startedAt.getTime()).toBe(startedBefore);
    });

    it('maps a rejected key like createSession and keeps the clock', async () => {
      const out = await liveSession();
      const startedBefore = (await rowOf(out.attemptId)).startedAt.getTime();
      voice.mintError = new ProviderError('Clé API refusée par OpenAI', 401);

      await expect(
        service.refreshToken(userId, { attemptId: out.attemptId })
      ).rejects.toMatchObject({ code: 'PROVIDER_KEY_REJECTED', status: 422 });
      expect((await rowOf(out.attemptId)).startedAt.getTime()).toBe(startedBefore);
    });

    it('maps other provider failures to BAD_GATEWAY', async () => {
      const out = await liveSession();
      voice.mintError = new ProviderError('Service indisponible', 503);
      await expect(
        service.refreshToken(userId, { attemptId: out.attemptId })
      ).rejects.toMatchObject({ code: 'BAD_GATEWAY', status: 502 });
    });

    it('never returns the upstream key', async () => {
      const out = await liveSession();
      const res = await service.refreshToken(userId, {
        attemptId: out.attemptId,
      });
      expect(JSON.stringify(res)).not.toContain(KEY);
    });
  });
});
