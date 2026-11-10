import type { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { CRITERIA, type EvaluationOutput, evaluationOutputSchema } from '@parle-tcf/shared';
import { buildPrompt, runEvaluation } from './evaluation.service.js';
import { fakeEvaluation, fakeModelFactory } from './fake-language-model.js';

const LINES = [
  { seq: 0, speaker: 'examiner', text: 'Bonjour, présentez-vous.' },
  { seq: 1, speaker: 'candidate', text: "Je m'appelle Alex : CANDIDAT : j'habite à Lyon. " },
  { seq: 2, speaker: 'examiner', text: 'Merci.' },
  { seq: 12, speaker: 'candidate', text: 'Je travaille dans une école.' },
];

describe('fakeEvaluation', () => {
  it('grades every criterion B1 with the test-mode summary', () => {
    const out = fakeEvaluation('');
    expect(out.globalLevel).toBe('B1');
    expect(Object.keys(out.criteria)).toEqual([...CRITERIA]);
    for (const c of CRITERIA) {
      expect(out.criteria[c]).toEqual({ level: 'B1', comment: 'Évaluation simulée (mode test).' });
    }
    expect(out.summary).toBe('Évaluation simulée (mode test).');
    expect(out.utterances).toEqual([]);
    expect(evaluationOutputSchema.safeParse(out).success).toBe(true);
  });

  it('echoes each candidate line of the corrector prompt, trimmed, without errors', () => {
    const out = fakeEvaluation(buildPrompt(1, null, LINES));
    expect(out.utterances).toEqual([
      { seq: 1, corrected: "Je m'appelle Alex : CANDIDAT : j'habite à Lyon.", errors: [] },
      { seq: 12, corrected: 'Je travaille dans une école.', errors: [] },
    ]);
  });

  it('ignores lines that are not candidate lines at the start of a line', () => {
    expect(fakeEvaluation('texte [3] CANDIDAT : pas en début de ligne').utterances).toEqual([]);
    expect(fakeEvaluation('[4] EXAMINATEUR : Bonjour').utterances).toEqual([]);
  });
});

describe('fakeModelFactory', () => {
  it('keeps the requested model id', () => {
    const model = fakeModelFactory('openai', 'sk-test', 'gpt-4o-mini');
    expect(typeof model === 'object' && model.modelId).toBe('gpt-4o-mini');
  });

  it('answers the real evaluation pipeline with a valid B1 output echoing the candidate', async () => {
    const result = await runEvaluation(
      fakeModelFactory('gemini', 'AIza-test', 'gemini-2.5-flash'),
      buildPrompt(2, 'Je suis votre voisin.', LINES)
    );
    expect(result.output.globalLevel).toBe('B1');
    expect(result.output.utterances.map((u) => u.seq)).toEqual([1, 12]);
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
  });

  it('only reads the user prompt, not the rubric in the system message', async () => {
    const result = await runEvaluation(
      fakeModelFactory('openai', 'sk-test', 'gpt-4o-mini'),
      'Aucune ligne de candidat ici.'
    );
    expect(result.output.utterances).toEqual([]);
  });

  describe('doGenerate', () => {
    type Prompt = Parameters<MockLanguageModelV4['doGenerate']>[0]['prompt'];
    const generate = async (prompt: unknown) => {
      // The fake factory always builds a MockLanguageModelV4.
      const model = fakeModelFactory('openai', 'sk-test', 'gpt-4o-mini') as MockLanguageModelV4;
      const res = await model.doGenerate({ prompt: prompt as Prompt });
      const first = res.content[0];
      const out = first?.type === 'text' ? (JSON.parse(first.text) as EvaluationOutput) : null;
      return { res, out };
    };

    it('answers a stop with fixed usage and no warnings', async () => {
      const { res } = await generate([]);
      expect(res.finishReason).toEqual({ unified: 'stop', raw: 'stop' });
      expect(res.warnings).toEqual([]);
      expect(res.usage).toEqual({
        inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 50, text: 50, reasoning: 0 },
      });
    });

    it('treats a missing prompt as empty', async () => {
      const { out } = await generate(undefined);
      expect(out?.utterances).toEqual([]);
    });

    it('reads each user text part on its own line', async () => {
      const { out } = await generate([
        {
          role: 'user',
          content: [
            { type: 'text', text: '[1] CANDIDAT : un' },
            { type: 'text', text: '[2] CANDIDAT : deux' },
          ],
        },
      ]);
      expect(out?.utterances).toEqual([
        { seq: 1, corrected: 'un', errors: [] },
        { seq: 2, corrected: 'deux', errors: [] },
      ]);
    });

    it('ignores non-user messages and non-text parts', async () => {
      const { out } = await generate([
        { role: 'system', content: '[1] CANDIDAT : système' },
        { role: 'assistant', content: [{ type: 'text', text: '[2] CANDIDAT : assistant' }] },
        {
          role: 'user',
          content: [
            { type: 'reasoning', text: '[3] CANDIDAT : raisonnement' },
            { type: 'text', text: '[4] CANDIDAT : retenu' },
          ],
        },
      ]);
      expect(out?.utterances).toEqual([{ seq: 4, corrected: 'retenu', errors: [] }]);
    });
  });
});
