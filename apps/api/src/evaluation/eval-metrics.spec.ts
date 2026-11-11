import { describe, expect, it } from 'vitest';
import type { EvaluationOutput } from '@parle-tcf/shared';
import {
  type CaseRun,
  type EvalCase,
  type EvalSummary,
  renderResultsTable,
  summarize,
} from './eval-metrics.js';

const crit = (l: 'A2' | 'B1' | 'B2') => ({
  adequation: { level: l, comment: 'x' },
  coherence: { level: l, comment: 'x' },
  vocabulaire: { level: l, comment: 'x' },
  grammaire: { level: l, comment: 'x' },
  aisance: { level: l, comment: 'x' },
});
const out = (l: 'A2' | 'B1' | 'B2'): EvaluationOutput => ({
  globalLevel: l,
  criteria: crit(l),
  summary: 'x',
  utterances: [],
});
const ref = (id: string, l: 'A2' | 'B1' | 'B2'): EvalCase => ({
  id,
  task: 2,
  prompt: null,
  human: {
    globalLevel: l,
    criteria: {
      adequation: l,
      coherence: l,
      vocabulaire: l,
      grammaire: l,
      aisance: l,
    },
  },
  transcript: [],
});
const run = (caseId: string, levels: ('A2' | 'B1' | 'B2')[]): CaseRun => ({
  caseId,
  outputs: levels.map(out),
  inputTokens: 100,
  outputTokens: 50,
  latencyMs: 2000,
});

describe('summarize', () => {
  it('computes agreement, error and stability', () => {
    const s = summarize(
      [ref('a', 'B1'), ref('b', 'B1'), ref('c', 'A2')],
      [run('a', ['B1', 'B1']), run('b', ['B2', 'B1']), run('c', ['B2', 'B2'])]
    );
    expect(s.exactMatch).toBeCloseTo(1 / 3);
    expect(s.withinOne).toBeCloseTo(2 / 3);
    expect(s.meanAbsError).toBeCloseTo(1);
    expect(s.stability).toBeCloseTo(2 / 3);
    expect(s.perCriterionExact.grammaire).toBeCloseTo(1 / 3);
    expect(s.inputTokens).toBe(300);
    expect(s.meanLatencyMs).toBe(2000);
  });
});

describe('summarize edge cases', () => {
  it('returns zeros without runs instead of dividing by zero', () => {
    const s = summarize([ref('a', 'B1')], []);
    expect(s).toEqual({
      cases: 0,
      exactMatch: 0,
      withinOne: 0,
      meanAbsError: 0,
      perCriterionExact: {
        adequation: 0,
        coherence: 0,
        vocabulaire: 0,
        grammaire: 0,
        aisance: 0,
      },
      stability: 0,
      inputTokens: 0,
      outputTokens: 0,
      meanLatencyMs: 0,
    });
  });

  it('ignores runs without a reference case or without outputs', () => {
    const s = summarize(
      [ref('a', 'B1')],
      [run('a', ['B1']), run('unknown', ['B1']), { ...run('a', []), caseId: 'a' }]
    );
    expect(s.inputTokens).toBe(100);
    expect(s.outputTokens).toBe(50);
  });

  it('scores the first pass only, and counts a two-level gap outside ±1', () => {
    const s = summarize([ref('a', 'A2')], [run('a', ['B2', 'A2'])]);
    expect(s.exactMatch).toBe(0);
    expect(s.withinOne).toBe(0);
    expect(s.meanAbsError).toBe(2);
    expect(s.stability).toBe(0);
  });

  it('counts a one-level gap as within one', () => {
    const s = summarize([ref('a', 'B1')], [run('a', ['A2'])]);
    expect(s.exactMatch).toBe(0);
    expect(s.withinOne).toBe(1);
    expect(s.meanAbsError).toBe(1);
    expect(s.stability).toBe(1);
  });
});

describe('renderResultsTable', () => {
  const summary: EvalSummary = {
    cases: 3,
    exactMatch: 2 / 3,
    withinOne: 1,
    meanAbsError: 0.3333,
    perCriterionExact: {
      adequation: 1,
      coherence: 0.5,
      vocabulaire: 0,
      grammaire: 2 / 3,
      aisance: 0.25,
    },
    stability: 0.5,
    inputTokens: 300,
    outputTokens: 150,
    meanLatencyMs: 2345,
  };

  it('renders the summary table and the per-criterion table', () => {
    expect(
      renderResultsTable([
        { model: 'gpt-4o-mini', summary, costUsd: 0.01234 },
        { model: 'mystery', summary: { ...summary, cases: 1 }, costUsd: null },
      ])
    ).toBe(
      [
        '| Model | Cases | Exact | ±1 level | Mean error | Stability | Mean latency | Cost |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
        '| gpt-4o-mini | 3 | 67 % | 100 % | 0.33 | 50 % | 2.3 s | $0.0123 |',
        '| mystery | 1 | 67 % | 100 % | 0.33 | 50 % | 2.3 s | — |',
        '',
        '| Model | adequation | coherence | vocabulaire | grammaire | aisance |',
        '| --- | --- | --- | --- | --- | --- |',
        '| gpt-4o-mini | 100 % | 50 % | 0 % | 67 % | 25 % |',
        '| mystery | 100 % | 50 % | 0 % | 67 % | 25 % |',
      ].join('\n')
    );
  });

  it('shows a zero cost as $0.0000, not as unknown', () => {
    const table = renderResultsTable([{ model: 'free', summary, costUsd: 0 }]);
    expect(table).toContain('| $0.0000 |');
    expect(table).not.toContain('—');
  });

  it('renders only the headers without rows', () => {
    expect(renderResultsTable([]).split('\n')).toHaveLength(5);
  });
});
