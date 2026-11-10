import { describe, expect, it } from 'vitest';
import { CRITERIA, evaluationOutputSchema } from '@parle-tcf/shared';
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
});
