import {
  CRITERIA,
  type CefrLevel,
  type Criterion,
  type EvaluationOutput,
  levelScore,
} from '@parle-tcf/shared';

export interface EvalCase {
  id: string;
  task: number;
  prompt: string | null;
  /** Reference levels assigned by a human rater. */
  human: { globalLevel: CefrLevel; criteria: Record<Criterion, CefrLevel> };
  transcript: {
    seq: number;
    speaker: 'examiner' | 'candidate';
    text: string;
  }[];
}

export interface CaseRun {
  caseId: string;
  /** One output per pass (stability needs several). */
  outputs: EvaluationOutput[];
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface EvalSummary {
  cases: number;
  exactMatch: number;
  withinOne: number;
  meanAbsError: number;
  perCriterionExact: Record<Criterion, number>;
  /** Share of cases whose passes all returned the same global level. */
  stability: number;
  inputTokens: number;
  outputTokens: number;
  meanLatencyMs: number;
}

const ratio = (n: number, d: number) => (d === 0 ? 0 : n / d);

/** Scores the first pass against the human reference, and stability over all passes. */
export function summarize(cases: EvalCase[], runs: CaseRun[]): EvalSummary {
  const byId = new Map(cases.map((c) => [c.id, c]));
  let exact = 0;
  let within = 0;
  let absErr = 0;
  let stable = 0;
  let latency = 0;
  let inTok = 0;
  let outTok = 0;
  const crit = Object.fromEntries(CRITERIA.map((c) => [c, 0])) as Record<Criterion, number>;

  for (const run of runs) {
    const ref = byId.get(run.caseId);
    const first = run.outputs[0];
    if (!ref || !first) continue;
    const diff = Math.abs(levelScore(first.globalLevel) - levelScore(ref.human.globalLevel));
    if (diff === 0) exact++;
    if (diff <= 1) within++;
    absErr += diff;
    for (const c of CRITERIA) {
      if (first.criteria[c].level === ref.human.criteria[c]) crit[c]++;
    }
    if (new Set(run.outputs.map((o) => o.globalLevel)).size === 1) stable++;
    latency += run.latencyMs;
    inTok += run.inputTokens;
    outTok += run.outputTokens;
  }

  const n = runs.length;
  return {
    cases: n,
    exactMatch: ratio(exact, n),
    withinOne: ratio(within, n),
    meanAbsError: ratio(absErr, n),
    perCriterionExact: Object.fromEntries(CRITERIA.map((c) => [c, ratio(crit[c], n)])) as Record<
      Criterion,
      number
    >,
    stability: ratio(stable, n),
    inputTokens: inTok,
    outputTokens: outTok,
    meanLatencyMs: ratio(latency, n),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0)} %`;

export function renderResultsTable(
  rows: { model: string; summary: EvalSummary; costUsd: number | null }[]
): string {
  const header =
    '| Modèle | Cas | Exact | ±1 niveau | Erreur moy. | Stabilité | Latence moy. | Coût |\n| --- | --- | --- | --- | --- | --- | --- | --- |';
  const body = rows.map(
    (r) =>
      `| ${r.model} | ${r.summary.cases} | ${pct(r.summary.exactMatch)} | ${pct(r.summary.withinOne)} | ${r.summary.meanAbsError.toFixed(2)} | ${pct(r.summary.stability)} | ${(r.summary.meanLatencyMs / 1000).toFixed(1)} s | ${r.costUsd === null ? '—' : `${r.costUsd.toFixed(4)} $`} |`
  );
  const crit = rows.map(
    (r) =>
      `| ${r.model} | ${CRITERIA.map((c) => pct(r.summary.perCriterionExact[c])).join(' | ')} |`
  );
  return [
    header,
    ...body,
    '',
    `| Modèle | ${CRITERIA.join(' | ')} |`,
    `| --- | ${CRITERIA.map(() => '---').join(' | ')} |`,
    ...crit,
  ].join('\n');
}
