/**
 * Runs the corrector against the human-labelled dataset and writes evals/results.md.
 *
 * Usage: OPENAI_API_KEY_EVALS=sk-... pnpm --filter @parle-tcf/api evals -- --model gpt-4o-mini,gpt-4.1-mini --passes 3
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenAI } from '@ai-sdk/openai';
import { estimateCost } from '@parle-tcf/shared';
import {
  type CaseRun,
  type EvalCase,
  renderResultsTable,
  summarize,
} from '../src/evaluation/eval-metrics.js';
import { buildPrompt, runEvaluation } from '../src/evaluation/evaluation.service.js';
import { RUBRIC_VERSION } from '../src/evaluation/rubric.js';

const dir = dirname(fileURLToPath(import.meta.url));

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const apiKey = process.env.OPENAI_API_KEY_EVALS;
if (!apiKey) {
  console.error('OPENAI_API_KEY_EVALS is required.');
  process.exit(1);
}

const models = arg('model', 'gpt-4o-mini').split(',');
const passes = Number(arg('passes', '3'));
const cases: EvalCase[] = readdirSync(join(dir, 'dataset'))
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(dir, 'dataset', f), 'utf8')) as EvalCase[]);

const rows = [];
for (const model of models) {
  const runs: CaseRun[] = [];
  for (const c of cases) {
    const prompt = buildPrompt(c.task, c.prompt, c.transcript);
    const outputs = [];
    let inputTokens = 0;
    let outputTokens = 0;
    const started = Date.now();
    for (let i = 0; i < passes; i++) {
      const res = await runEvaluation(createOpenAI({ apiKey })(model), prompt);
      outputs.push(res.output);
      inputTokens += res.inputTokens;
      outputTokens += res.outputTokens;
    }
    runs.push({
      caseId: c.id,
      outputs,
      inputTokens,
      outputTokens,
      latencyMs: (Date.now() - started) / passes,
    });
    console.log(
      `${model} ${c.id}: ${outputs.map((o) => o.globalLevel).join(',')} (human ${c.human.globalLevel})`
    );
  }
  const summary = summarize(cases, runs);
  rows.push({
    model,
    summary,
    costUsd: estimateCost(model, summary.inputTokens, summary.outputTokens),
  });
}

const md = `# Corrector evaluation results

Rubric \`${RUBRIC_VERSION}\` · ${cases.length} cases · ${passes} passes per case · ${new Date().toISOString().slice(0, 10)}

${renderResultsTable(rows)}

> The reference levels of the dataset are **synthetic** (written by the maintainer): they measure the corrector's consistency, not its agreement with a certified examiner.
`;
writeFileSync(join(dir, 'results.md'), md);
console.log(md);
