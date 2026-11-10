import { MockLanguageModelV4 } from 'ai/test';
import { CRITERIA, type EvaluationOutput } from '@parle-tcf/shared';
import type { LanguageModelFactory } from './evaluation.service.js';

const CANDIDATE_LINE = /^\[(\d+)\] CANDIDAT : (.+)$/gm;

/** The prompt text sent to the corrector (user messages only). */
function promptText(prompt: unknown): string {
  if (!Array.isArray(prompt)) return '';
  const parts: string[] = [];
  for (const message of prompt as { role?: string; content?: unknown }[]) {
    if (message.role !== 'user' || !Array.isArray(message.content)) continue;
    for (const part of message.content as { type?: string; text?: string }[]) {
      if (part.type === 'text' && part.text) parts.push(part.text);
    }
  }
  return parts.join('\n');
}

/** Deterministic B1 evaluation echoing each candidate line (no corrections). */
export function fakeEvaluation(prompt: string): EvaluationOutput {
  const utterances = [...prompt.matchAll(CANDIDATE_LINE)].map((m) => ({
    seq: Number(m[1]),
    corrected: m[2].trim(),
    errors: [],
  }));
  return {
    globalLevel: 'B1',
    criteria: Object.fromEntries(
      CRITERIA.map((c) => [c, { level: 'B1', comment: 'Évaluation simulée (mode test).' }])
    ) as EvaluationOutput['criteria'],
    summary: 'Évaluation simulée (mode test).',
    utterances,
  };
}

/** Corrector model for `VOICE_PROVIDER=fake`: answers instantly, never calls a provider. */
export const fakeModelFactory: LanguageModelFactory = (_provider, _apiKey, modelId) =>
  new MockLanguageModelV4({
    modelId,
    doGenerate: (options) =>
      Promise.resolve({
        content: [
          { type: 'text', text: JSON.stringify(fakeEvaluation(promptText(options.prompt))) },
        ],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 50, text: 50, reasoning: 0 },
        },
        warnings: [],
      }),
  });
