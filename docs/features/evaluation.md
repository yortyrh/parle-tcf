# Evaluation

## Summary

After each task, a separate text model grades the candidate's transcript against a CEFR rubric (A1–C2): a global level, a level and a comment for each of five criteria, a short summary, and a corrected version of every candidate line with typed errors. A full exam also gets an overall level. Every evaluation is presented as an indicative estimate, not a TCF score. See [ADR 0003](../adr/0003-in-process-evaluation.md).

## User flow

The result page (`/resultats/<attemptId>`) shows « Évaluation en cours » and polls until the evaluation is done. If it fails, the transcript is kept and the user can start it again (« Relancer l'évaluation »).

## How it works

- **Trigger:** `/attempts/complete` closes the attempt; the API then calls `EvaluationService.evaluate` in the background (in-process, fire-and-forget, never throws). A claim on the row prevents two concurrent runs.
- **Prompt:** system prompt `apps/api/config/français/rubrique-v1.md` (rubric v1: warnings about speech recognition artefacts, the five criteria, expectations per task, output rules, CEFR descriptors). The user prompt holds the task, the subject and the numbered transcript (`buildPrompt`).
- **Criteria:** `adequation` (task fulfilment), `coherence`, `vocabulaire`, `grammaire`, `aisance` (fluency visible in the text; pronunciation is not judged).
- **Model call:** Vercel AI SDK structured output with the Zod schema of `packages/shared/src/schemas/evaluation.ts`, `temperature: 0`, with the user's key: OpenAI (`gpt-4o-mini` by default) or Gemini (`gemini-2.5-flash`), overridable per user ("text model" in settings).
- **Validation:** up to 3 tries when the output is missing or does not match the schema. Error excerpts are located in the original line (`locateErrors`) so the UI can highlight them.
- **No candidate speech:** the evaluation fails with a clear message instead of inventing a level.
- **Overall level of a full exam:** once the three tasks are graded, a deterministic weighted median (weights 1, 1.5, 2 for Tâches 1, 2, 3) is stored on the run. No LLM call.
- **Recovery:** evaluations stuck in `running` for 5 minutes become `failed`; `/attempts/reevaluate` requeues them (refused while one is running).
- **Cost:** corrector tokens are added to the attempt's cost.

## Quality: evals

`pnpm --filter @parle-tcf/api evals -- --model <ids> --passes 3` (needs `OPENAI_API_KEY_EVALS`) runs the corrector on a labelled dataset (`apps/api/evals/dataset`, synthetic for now) and reports exact and ±1 level agreement, per-criterion agreement, stability across passes, cost and latency. The `evals.yml` workflow runs it manually.

## API

`/attempts/get` (evaluation included), `/attempts/reevaluate`, `/runs/get`.

## Data

`evaluations`: status (`pending`, `running`, `done`, `failed`), global level, per-criterion levels and comments, summary, corrector model, rubric version, error message. `transcripts`: corrected text and errors per candidate line. `exam_runs.global_level`.

## Configuration

Rubric file `apps/api/config/français/rubrique-v1.md`; per-user text model; `VOICE_PROVIDER=fake` swaps the corrector for a fake language model in tests.

## Code map

`apps/api/src/evaluation/evaluation.service.ts`, `rubric.ts`, `eval-metrics.ts`, `fake-language-model.ts`; `apps/api/evals/run.ts`; `packages/shared/src/schemas/evaluation.ts`.

## Tests

`evaluation.service.spec.ts` (schema retries, failure keeps the transcript, cross-user requeue), `eval-metrics.spec.ts`, `packages/shared/src/schemas/evaluation.spec.ts` (weighted median), `apps/api/test/integration/attempts.spec.ts`.
