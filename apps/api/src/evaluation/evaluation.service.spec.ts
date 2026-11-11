import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { contentHash, eq, examAttempts, examRuns, exercises, transcripts } from '@parle-tcf/db';
import { type TestDb, createTestDb } from '@parle-tcf/db/testing';
import { estimateCost } from '@parle-tcf/shared';
import { AttemptsService } from '../attempts/attempts.service.js';
import { ProviderSettingsService } from '../settings/provider-settings.service.js';
import { fakeVoiceProvider, registryOf, testCipher } from '../test-helpers.js';
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  DEFAULT_TEXT_MODEL,
  EvaluationService,
  type LanguageModelFactory,
  STALE_RUNNING_MS,
  buildPrompt,
  locateErrors,
  providerModelFactory,
  runEvaluation,
} from './evaluation.service.js';

const KEY = 'sk-test-0123456789abcdef';

const goodOutput = {
  globalLevel: 'B1',
  criteria: Object.fromEntries(
    ['adequation', 'coherence', 'vocabulaire', 'grammaire', 'aisance'].map((c) => [
      c,
      { level: 'B1', comment: 'Correct.' },
    ])
  ),
  summary: 'Bon niveau B1.',
  utterances: [
    {
      seq: 1,
      corrected: 'Je suis allé au marché.',
      errors: [
        {
          excerpt: 'suis allé à le',
          type: 'grammaire',
          explanation: 'Contraction.',
        },
        {
          excerpt: 'introuvable',
          type: 'lexique',
          explanation: 'Absent du texte.',
        },
      ],
    },
  ],
};

function result(text: string, tokens = { input: 100, output: 50 }) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: {
      inputTokens: { total: tokens.input, noCache: tokens.input, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: tokens.output, text: tokens.output, reasoning: 0 },
    },
    warnings: [],
  };
}

/** The user prompt the model received on its `index`-th call. */
function userPromptOf(model: MockLanguageModelV4, index = 0): string {
  const call = model.doGenerateCalls[index];
  const user = call?.prompt.find((m) => m.role === 'user');
  if (!user || typeof user.content === 'string') return '';
  return user.content.map((p) => (p.type === 'text' ? p.text : '')).join('');
}

describe('locateErrors', () => {
  it('keeps verbatim excerpts and drops paraphrased ones', () => {
    const out = locateErrors('Je suis allé à le marché.', [
      { excerpt: 'suis allé à le', type: 'grammaire', explanation: 'x' },
      { excerpt: 'absent', type: 'lexique', explanation: 'y' },
    ]);
    expect(out).toEqual([{ start: 3, end: 17, type: 'grammaire', explanation: 'x' }]);
  });

  it('keeps an excerpt found at the very start of the text', () => {
    expect(
      locateErrors('Je suis allé', [{ excerpt: 'Je suis', type: 'grammaire', explanation: 'x' }])
    ).toEqual([{ start: 0, end: 7, type: 'grammaire', explanation: 'x' }]);
  });
});

describe('buildPrompt', () => {
  const lines = [
    { seq: 0, speaker: 'examiner', text: 'Bonjour' },
    { seq: 1, speaker: 'candidate', text: 'Salut' },
  ];

  it('lays out the task, the subject, the labelled transcript and the instruction', () => {
    expect(buildPrompt(2, 'Organiser une fête', lines)).toBe(
      [
        'Tâche 2 du TCF.',
        'Consigne / sujet :\nOrganiser une fête',
        "Transcription (issue d'une reconnaissance vocale) :\n[0] EXAMINATEUR : Bonjour\n[1] CANDIDAT : Salut",
        'Évalue le candidat selon la rubrique.',
      ].join('\n\n')
    );
  });

  it('leaves the subject block out when there is none', () => {
    expect(buildPrompt(1, null, lines)).toBe(
      [
        'Tâche 1 du TCF.',
        "Transcription (issue d'une reconnaissance vocale) :\n[0] EXAMINATEUR : Bonjour\n[1] CANDIDAT : Salut",
        'Évalue le candidat selon la rubrique.',
      ].join('\n\n')
    );
  });
});

describe('runEvaluation', () => {
  it('rethrows the last error after three failed tries', async () => {
    let n = 0;
    const model = new MockLanguageModelV4({
      doGenerate: () => {
        n += 1;
        return Promise.reject(new Error(`échec ${n}`));
      },
    });
    await expect(runEvaluation(model, 'p')).rejects.toThrow('échec 3');
    expect(model.doGenerateCalls).toHaveLength(3);
  });

  it('wraps a non-Error failure in a generic error', async () => {
    const model = new MockLanguageModelV4({
      // A provider SDK may reject with a non-Error value.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      doGenerate: () => Promise.reject('boom'),
    });
    await expect(runEvaluation(model, 'p')).rejects.toThrow('Evaluation failed');
  });

  it('returns the parsed output with its token usage', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: result(JSON.stringify(goodOutput), { input: 7, output: 3 }),
    });
    const res = await runEvaluation(model, 'le prompt');
    expect(res).toEqual({ output: goodOutput, inputTokens: 7, outputTokens: 3 });
    expect(userPromptOf(model)).toBe('le prompt');
  });
});

describe('providerModelFactory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    ['openai', 'gpt-4o-mini', 'openai.responses', 'authorization', 'Bearer sk-user-key'],
    ['gemini', 'gemini-2.5-flash', 'google.generative-ai', 'x-goog-api-key', 'sk-user-key'],
  ] as const)(
    'builds a %s model that calls the provider with the user key',
    async (provider, modelId, providerName, header, value) => {
      vi.stubEnv('OPENAI_API_KEY', undefined);
      vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', undefined);
      const seen: Record<string, string>[] = [];
      vi.stubGlobal('fetch', (_url: string, init: { headers: Record<string, string> }) => {
        seen.push(init.headers);
        return Promise.resolve(
          new Response('{"error":{"message":"stop"}}', {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
        );
      });
      const model = providerModelFactory(provider, 'sk-user-key', modelId);
      if (typeof model === 'string') throw new Error('expected a model object');
      expect(model.provider).toBe(providerName);
      expect(model.modelId).toBe(modelId);
      await Promise.resolve(
        model.doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
      ).catch(() => undefined);
      expect(seen).toHaveLength(1);
      expect(seen[0]?.[header]).toBe(value);
    }
  );
});

describe('EvaluationService', () => {
  let testDb: TestDb;
  let attempts: AttemptsService;
  let settings: ProviderSettingsService;
  let userId: string;
  let attemptId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
    userId = await testDb.createUser();
    attempts = new AttemptsService(testDb.db);
    settings = new ProviderSettingsService(
      testDb.db,
      testCipher(),
      registryOf(fakeVoiceProvider())
    );
    await settings.upsert(userId, { apiKey: KEY });
    const a = await attempts.create({
      userId,
      mode: 'practice',
      runId: null,
      exerciseId: null,
      task: 2,
      model: 'gpt-realtime-mini',
    });
    attemptId = a.id;
    await attempts.complete(userId, {
      attemptId,
      lines: [
        { seq: 0, speaker: 'examiner', text: 'Bonjour' },
        { seq: 1, speaker: 'candidate', text: 'Je suis allé à le marché.' },
      ],
      usage: { inputTokens: 1000, outputTokens: 500 },
    });
  });

  const serviceWith = (model: MockLanguageModelV4) =>
    new EvaluationService(testDb.db, settings, () => model);

  it('stores the evaluation, the corrections and the cost', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: result(JSON.stringify(goodOutput)),
    });
    await serviceWith(model).evaluate(userId, attemptId);

    const detail = await attempts.get(userId, attemptId);
    expect(detail.evaluationStatus).toBe('done');
    expect(detail.evaluation?.globalLevel).toBe('B1');
    expect(detail.evaluation?.summary).toBe('Bon niveau B1.');
    const line = detail.transcript.find((l) => l.seq === 1);
    expect(line?.correctedText).toBe('Je suis allé au marché.');
    expect(line?.errors).toHaveLength(1);
    expect(detail.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('retries on an invalid output, then succeeds', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [result('pas du json'), result(JSON.stringify(goodOutput))],
    });
    await serviceWith(model).evaluate(userId, attemptId);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect((await attempts.get(userId, attemptId)).evaluationStatus).toBe('done');
  });

  it('marks the evaluation failed after 3 bad outputs, keeping the transcript', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: result('{}'),
    });
    await serviceWith(model).evaluate(userId, attemptId);
    expect(model.doGenerateCalls).toHaveLength(3);
    const detail = await attempts.get(userId, attemptId);
    expect(detail.evaluationStatus).toBe('failed');
    expect(detail.evaluation).toBeNull();
    expect(detail.transcript).toHaveLength(2);
  });

  it("never evaluates someone else's attempt", async () => {
    const other = await testDb.createUser('other@test.local');
    const model = new MockLanguageModelV4({
      doGenerate: result(JSON.stringify(goodOutput)),
    });
    await serviceWith(model).evaluate(other, attemptId);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(await serviceWith(model).requeue(other, attemptId)).toBe('not_found');
    expect((await attempts.get(userId, attemptId)).evaluationStatus).toBe('pending');
  });

  it('marks stale running evaluations as failed', async () => {
    await testDb.db
      .update(examAttempts)
      .set({
        evaluationStatus: 'running',
        finishedAt: new Date(Date.now() - 10 * 60_000),
      })
      .where(eq(examAttempts.id, attemptId));
    await serviceWith(new MockLanguageModelV4()).failStale();
    expect((await attempts.get(userId, attemptId)).evaluationStatus).toBe('failed');
  });

  it('sets the run level once the three tasks are graded', async () => {
    const [run] = await testDb.db.insert(examRuns).values({ userId, mode: 'full' }).returning();
    const svc = serviceWith(
      new MockLanguageModelV4({
        doGenerate: result(JSON.stringify(goodOutput)),
      })
    );
    for (const task of [1, 2, 3]) {
      const a = await attempts.create({
        userId,
        mode: 'full',
        runId: run.id,
        exerciseId: null,
        task,
        model: 'gpt-realtime-mini',
      });
      await attempts.complete(userId, {
        attemptId: a.id,
        lines: [{ seq: 0, speaker: 'candidate', text: 'Bonjour madame.' }],
      });
      await svc.evaluate(userId, a.id);
    }
    const [row] = await testDb.db.select().from(examRuns).where(eq(examRuns.id, run.id));
    expect(row?.globalLevel).toBe('B1');
  });
  const goodModel = () =>
    new MockLanguageModelV4({
      doGenerate: result(JSON.stringify(goodOutput)),
    });

  const setRow = (id: string, values: Partial<typeof examAttempts.$inferInsert>) =>
    testDb.db.update(examAttempts).set(values).where(eq(examAttempts.id, id));

  const rowOf = async (id: string) => {
    const [row] = await testDb.db.select().from(examAttempts).where(eq(examAttempts.id, id));
    return row;
  };

  describe('corrector input', () => {
    const recordingFactory = (model: MockLanguageModelV4) => {
      const calls: Parameters<LanguageModelFactory>[] = [];
      const factory: LanguageModelFactory = (...args) => {
        calls.push(args);
        return model;
      };
      return { calls, factory };
    };

    it('uses the default OpenAI text model with the user key', async () => {
      const { calls, factory } = recordingFactory(goodModel());
      await new EvaluationService(testDb.db, settings, factory).evaluate(userId, attemptId);
      expect(calls).toEqual([['openai', KEY, DEFAULT_TEXT_MODEL]]);
      expect((await attempts.get(userId, attemptId)).evaluation?.correctorModel).toBe(
        DEFAULT_TEXT_MODEL
      );
    });

    it('defaults Gemini users to gemini-3.5-flash-lite (gemini-2.5-flash shuts down)', () => {
      expect(DEFAULT_GEMINI_TEXT_MODEL).toBe('gemini-3.5-flash-lite');
    });

    it('uses the default Gemini text model for a Gemini user', async () => {
      const geminiSettings = new ProviderSettingsService(
        testDb.db,
        testCipher(),
        registryOf(fakeVoiceProvider(), fakeVoiceProvider('gemini'))
      );
      await geminiSettings.upsert(userId, {
        provider: 'gemini',
        apiKey: 'AIzaSyTestKey0123456789',
      });
      const { calls, factory } = recordingFactory(goodModel());
      await new EvaluationService(testDb.db, geminiSettings, factory).evaluate(userId, attemptId);
      expect(calls).toEqual([['gemini', 'AIzaSyTestKey0123456789', 'gemini-3.5-flash-lite']]);
      expect((await attempts.get(userId, attemptId)).evaluation?.correctorModel).toBe(
        'gemini-3.5-flash-lite'
      );
    });

    it("prefers the user's own text model", async () => {
      await settings.upsert(userId, { textModel: 'gpt-4.1' });
      const { calls, factory } = recordingFactory(goodModel());
      await new EvaluationService(testDb.db, settings, factory).evaluate(userId, attemptId);
      expect(calls[0]?.[2]).toBe('gpt-4.1');
    });

    it("sends the subject of the attempt's exercise", async () => {
      await testDb.db.insert(exercises).values({
        id: 'x-eval',
        task: 2,
        prompt: 'Vous organisez une fête.',
        contentHash: contentHash('Vous organisez une fête.'),
        isImageBased: false,
      });
      await setRow(attemptId, { exerciseId: 'x-eval' });
      const model = goodModel();
      await serviceWith(model).evaluate(userId, attemptId);
      expect(userPromptOf(model)).toBe(
        buildPrompt(2, 'Vous organisez une fête.', [
          { seq: 0, speaker: 'examiner', text: 'Bonjour' },
          { seq: 1, speaker: 'candidate', text: 'Je suis allé à le marché.' },
        ])
      );
    });

    it('sends no subject when the attempt has no exercise', async () => {
      const model = goodModel();
      await serviceWith(model).evaluate(userId, attemptId);
      expect(userPromptOf(model)).not.toContain('Consigne');
      expect(userPromptOf(model)).toContain('Tâche 2 du TCF.');
    });

    it('fails without calling the model when the candidate never spoke', async () => {
      const a = await attempts.create({
        userId,
        mode: 'practice',
        runId: null,
        exerciseId: null,
        task: 3,
        model: 'gpt-realtime-mini',
      });
      await attempts.complete(userId, {
        attemptId: a.id,
        lines: [{ seq: 0, speaker: 'examiner', text: 'Bonjour, présentez-vous.' }],
      });
      const model = goodModel();
      await serviceWith(model).evaluate(userId, a.id);
      expect(model.doGenerateCalls).toHaveLength(0);
      expect((await rowOf(a.id)).evaluationStatus).toBe('failed');
    });
  });

  describe('saving', () => {
    it("never writes a correction on the examiner's lines", async () => {
      const withExaminer = {
        ...goodOutput,
        utterances: [...goodOutput.utterances, { seq: 0, corrected: 'Bonsoir', errors: [] }],
      };
      await serviceWith(
        new MockLanguageModelV4({ doGenerate: result(JSON.stringify(withExaminer)) })
      ).evaluate(userId, attemptId);
      const lines = await testDb.db
        .select()
        .from(transcripts)
        .where(eq(transcripts.attemptId, attemptId))
        .orderBy(transcripts.seq);
      expect(lines[0]?.correctedText).toBeNull();
      expect(lines[1]?.correctedText).toBe('Je suis allé au marché.');
    });

    it('adds the corrector cost to the realtime cost', async () => {
      const before = Number((await rowOf(attemptId)).estimatedCostUsd);
      const tokens = { input: 2_000_000, output: 1_000_000 };
      await serviceWith(
        new MockLanguageModelV4({ doGenerate: result(JSON.stringify(goodOutput), tokens) })
      ).evaluate(userId, attemptId);
      const added = estimateCost(DEFAULT_TEXT_MODEL, tokens.input, tokens.output) ?? 0;
      expect(added).toBeGreaterThan(0.5);
      expect(Number((await rowOf(attemptId)).estimatedCostUsd)).toBeCloseTo(before + added, 4);
    });

    it('adds nothing for a model without a known price', async () => {
      await settings.upsert(userId, { textModel: 'modele-inconnu' });
      const before = Number((await rowOf(attemptId)).estimatedCostUsd);
      await serviceWith(goodModel()).evaluate(userId, attemptId);
      const row = await rowOf(attemptId);
      expect(row.evaluationStatus).toBe('done');
      expect(Number(row.estimatedCostUsd)).toBeCloseTo(before, 4);
    });

    it('leaves the run level unset until all three tasks are graded', async () => {
      const [run] = await testDb.db.insert(examRuns).values({ userId, mode: 'full' }).returning();
      const svc = serviceWith(goodModel());
      for (const task of [1, 2]) {
        const a = await attempts.create({
          userId,
          mode: 'full',
          runId: run.id,
          exerciseId: null,
          task,
          model: 'gpt-realtime-mini',
        });
        await attempts.complete(userId, {
          attemptId: a.id,
          lines: [{ seq: 0, speaker: 'candidate', text: 'Bonjour madame.' }],
        });
        await svc.evaluate(userId, a.id);
      }
      const [row] = await testDb.db.select().from(examRuns).where(eq(examRuns.id, run.id));
      expect(row?.globalLevel).toBeNull();
      expect(row?.finishedAt).toBeNull();
    });
  });

  describe('start', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('logs a crash of the evaluation instead of throwing', async () => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const svc = serviceWith(goodModel());
      vi.spyOn(svc, 'evaluate').mockRejectedValue(new Error('db down'));
      expect(() => svc.start(userId, attemptId)).not.toThrow();
      await vi.waitFor(() => {
        expect(error).toHaveBeenCalledTimes(1);
      });
      expect(error.mock.calls[0]?.[0]).toBe(
        `Evaluation crashed for attempt ${attemptId}: Error: db down`
      );
    });
  });

  describe('atomic claim', () => {
    it('evaluates only once when two evaluations race', async () => {
      const model = goodModel();
      const svc = serviceWith(model);
      await Promise.all([svc.evaluate(userId, attemptId), svc.evaluate(userId, attemptId)]);
      expect(model.doGenerateCalls).toHaveLength(1);
      expect((await rowOf(attemptId)).evaluationStatus).toBe('done');
    });

    it('does not evaluate again once done', async () => {
      const model = goodModel();
      const svc = serviceWith(model);
      await svc.evaluate(userId, attemptId);
      await svc.evaluate(userId, attemptId);
      expect(model.doGenerateCalls).toHaveLength(1);
      expect((await rowOf(attemptId)).evaluationStatus).toBe('done');
    });

    it.each(['running', 'failed', 'done'] as const)(
      'leaves an attempt whose evaluation is %s alone',
      async (status) => {
        const startedAt = new Date(Date.now() - 60_000);
        await setRow(attemptId, {
          evaluationStatus: status,
          evaluationStartedAt: startedAt,
        });
        const model = goodModel();
        await serviceWith(model).evaluate(userId, attemptId);
        expect(model.doGenerateCalls).toHaveLength(0);
        const row = await rowOf(attemptId);
        expect(row.evaluationStatus).toBe(status);
        expect(row.evaluationStartedAt?.getTime()).toBe(startedAt.getTime());
      }
    );

    it('does not claim an attempt that is not completed', async () => {
      const a = await attempts.create({
        userId,
        mode: 'practice',
        runId: null,
        exerciseId: null,
        task: 2,
        model: 'gpt-realtime-mini',
      });
      const model = goodModel();
      await serviceWith(model).evaluate(userId, a.id);
      expect(model.doGenerateCalls).toHaveLength(0);
      const row = await rowOf(a.id);
      expect(row.evaluationStatus).toBe('pending');
      expect(row.evaluationStartedAt).toBeNull();
    });

    it("does not claim someone else's attempt", async () => {
      const other = await testDb.createUser('intruder@test.local');
      await serviceWith(goodModel()).evaluate(other, attemptId);
      const row = await rowOf(attemptId);
      expect(row.evaluationStatus).toBe('pending');
      expect(row.evaluationStartedAt).toBeNull();
    });

    it('marks the attempt running with its start time while the model works', async () => {
      const seen: { status?: string; startedAt?: number | null } = {};
      const before = Date.now();
      const model = new MockLanguageModelV4({
        doGenerate: async () => {
          const row = await rowOf(attemptId);
          seen.status = row.evaluationStatus;
          seen.startedAt = row.evaluationStartedAt?.getTime() ?? null;
          return result(JSON.stringify(goodOutput));
        },
      });
      await serviceWith(model).evaluate(userId, attemptId);
      const after = Date.now();

      expect(seen.status).toBe('running');
      expect(seen.startedAt).toEqual(expect.any(Number));
      expect(seen.startedAt!).toBeGreaterThanOrEqual(before - 1000);
      expect(seen.startedAt!).toBeLessThanOrEqual(after + 1000);
      expect((await rowOf(attemptId)).evaluationStatus).toBe('done');
    });
  });

  describe('requeue', () => {
    it.each(['failed', 'done'] as const)(
      'queues a %s evaluation and runs it again',
      async (status) => {
        await setRow(attemptId, { evaluationStatus: status });
        const model = goodModel();
        expect(await serviceWith(model).requeue(userId, attemptId)).toBe('queued');
        await vi.waitFor(async () => {
          expect((await rowOf(attemptId)).evaluationStatus).toBe('done');
        });
        expect(model.doGenerateCalls).toHaveLength(1);
      }
    );

    it('reports a running evaluation without touching it', async () => {
      const startedAt = new Date(Date.now() - 60_000);
      await setRow(attemptId, {
        evaluationStatus: 'running',
        evaluationStartedAt: startedAt,
      });
      const model = goodModel();
      expect(await serviceWith(model).requeue(userId, attemptId)).toBe('running');
      // Give a (wrongly) started evaluation the chance to run.
      await new Promise((r) => setTimeout(r, 50));
      expect(model.doGenerateCalls).toHaveLength(0);
      const row = await rowOf(attemptId);
      expect(row.evaluationStatus).toBe('running');
      expect(row.evaluationStartedAt?.getTime()).toBe(startedAt.getTime());
    });

    it('reports not_found for an unknown attempt', async () => {
      expect(
        await serviceWith(goodModel()).requeue(userId, '00000000-0000-4000-8000-000000000000')
      ).toBe('not_found');
    });

    it('reports not_found for an attempt that is not completed', async () => {
      const a = await attempts.create({
        userId,
        mode: 'practice',
        runId: null,
        exerciseId: null,
        task: 2,
        model: 'gpt-realtime-mini',
      });
      await setRow(a.id, { evaluationStatus: 'failed' });
      expect(await serviceWith(goodModel()).requeue(userId, a.id)).toBe('not_found');
      expect((await rowOf(a.id)).evaluationStatus).toBe('failed');
    });

    it('reports not_found for an unfinished attempt marked running', async () => {
      const a = await attempts.create({
        userId,
        mode: 'practice',
        runId: null,
        exerciseId: null,
        task: 2,
        model: 'gpt-realtime-mini',
      });
      await setRow(a.id, { evaluationStatus: 'running' });
      expect(await serviceWith(goodModel()).requeue(userId, a.id)).toBe('not_found');
    });

    it("reports not_found for another user's running evaluation", async () => {
      const other = await testDb.createUser('intruder@test.local');
      await setRow(attemptId, { evaluationStatus: 'running' });
      expect(await serviceWith(goodModel()).requeue(other, attemptId)).toBe('not_found');
    });

    it("never requeues another user's failed evaluation", async () => {
      const other = await testDb.createUser('intruder@test.local');
      await setRow(attemptId, { evaluationStatus: 'failed' });
      expect(await serviceWith(goodModel()).requeue(other, attemptId)).toBe('not_found');
      expect((await rowOf(attemptId)).evaluationStatus).toBe('failed');
    });
  });

  describe('failStale', () => {
    const now = new Date('2026-03-10T12:00:00.000Z');
    const ago = (ms: number) => new Date(now.getTime() - ms);

    it('fails a running evaluation that started before the window', async () => {
      await setRow(attemptId, {
        evaluationStatus: 'running',
        evaluationStartedAt: ago(STALE_RUNNING_MS + 1),
        finishedAt: ago(STALE_RUNNING_MS + 1),
      });
      await serviceWith(goodModel()).failStale(now);
      expect((await rowOf(attemptId)).evaluationStatus).toBe('failed');
    });

    it('keeps a running evaluation exactly at the edge of the window', async () => {
      await setRow(attemptId, {
        evaluationStatus: 'running',
        evaluationStartedAt: ago(STALE_RUNNING_MS),
        finishedAt: ago(STALE_RUNNING_MS),
      });
      await serviceWith(goodModel()).failStale(now);
      expect((await rowOf(attemptId)).evaluationStatus).toBe('running');
    });

    it('keeps a recently requeued evaluation of an old attempt running', async () => {
      await setRow(attemptId, {
        evaluationStatus: 'running',
        evaluationStartedAt: ago(60_000),
        finishedAt: ago(30 * 24 * 3600_000),
      });
      await serviceWith(goodModel()).failStale(now);
      expect((await rowOf(attemptId)).evaluationStatus).toBe('running');
    });

    it('falls back to finishedAt when the start time is unknown', async () => {
      const recent = await attempts.create({
        userId,
        mode: 'practice',
        runId: null,
        exerciseId: null,
        task: 3,
        model: 'gpt-realtime-mini',
      });
      await setRow(attemptId, {
        evaluationStatus: 'running',
        evaluationStartedAt: null,
        finishedAt: ago(STALE_RUNNING_MS + 60_000),
      });
      await setRow(recent.id, {
        status: 'completed',
        evaluationStatus: 'running',
        evaluationStartedAt: null,
        finishedAt: ago(60_000),
      });
      await serviceWith(goodModel()).failStale(now);
      expect((await rowOf(attemptId)).evaluationStatus).toBe('failed');
      expect((await rowOf(recent.id)).evaluationStatus).toBe('running');
    });

    it.each(['pending', 'done'] as const)('never touches a %s evaluation', async (status) => {
      await setRow(attemptId, {
        evaluationStatus: status,
        evaluationStartedAt: ago(24 * 3600_000),
        finishedAt: ago(24 * 3600_000),
      });
      await serviceWith(goodModel()).failStale(now);
      expect((await rowOf(attemptId)).evaluationStatus).toBe(status);
    });
  });
});
