import { z } from 'zod';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const cefrLevelSchema = z.enum(CEFR_LEVELS);
export type CefrLevel = z.infer<typeof cefrLevelSchema>;

export const CRITERIA = ['adequation', 'coherence', 'vocabulaire', 'grammaire', 'aisance'] as const;
export const criterionSchema = z.enum(CRITERIA);
export type Criterion = z.infer<typeof criterionSchema>;

export const CRITERION_LABELS: Record<Criterion, string> = {
  adequation: 'Adéquation à la tâche',
  coherence: 'Cohérence et cohésion',
  vocabulaire: 'Vocabulaire',
  grammaire: 'Grammaire',
  aisance: 'Aisance et prononciation',
};

export const errorTypeSchema = z.enum(['grammaire', 'lexique', 'syntaxe', 'registre']);

const criterionResultSchema = z.object({
  level: cefrLevelSchema,
  comment: z.string().min(1).max(1000),
});

/** What the corrector model must return. */
export const evaluationOutputSchema = z.object({
  globalLevel: cefrLevelSchema,
  criteria: z.object({
    adequation: criterionResultSchema,
    coherence: criterionResultSchema,
    vocabulaire: criterionResultSchema,
    grammaire: criterionResultSchema,
    aisance: criterionResultSchema,
  }),
  summary: z.string().min(1).max(2000),
  utterances: z.array(
    z.object({
      seq: z.number().int().nonnegative(),
      corrected: z.string().min(1).max(20_000),
      errors: z.array(
        z.object({
          /** The faulty fragment, copied verbatim from the candidate's text. */
          excerpt: z.string().min(1).max(500),
          type: errorTypeSchema,
          explanation: z.string().min(1).max(500),
        })
      ),
    })
  ),
});
export type EvaluationOutput = z.infer<typeof evaluationOutputSchema>;

/** Evaluation as exposed by the API. */
export const evaluationSchema = z.object({
  globalLevel: cefrLevelSchema,
  criteria: evaluationOutputSchema.shape.criteria,
  summary: z.string(),
  correctorModel: z.string(),
  rubricVersion: z.string(),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const transcriptErrorSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  type: errorTypeSchema,
  explanation: z.string(),
});

export const EVALUATION_DISCLAIMER =
  "Évaluation indicative, non officielle : elle ne remplace pas la note d'un examinateur certifié.";

const LEVEL_SCORE: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};
export const levelScore = (level: CefrLevel): number => LEVEL_SCORE[level];
export const scoreToLevel = (score: number): CefrLevel =>
  CEFR_LEVELS[Math.min(5, Math.max(0, Math.round(score) - 1))];

/** Weight of each task in the overall level of a full exam. */
const TASK_WEIGHT: Record<number, number> = { 1: 1, 2: 1.5, 3: 2 };

/** Weighted median of the per-task levels (deterministic, no LLM). */
export function weightedMedianLevel(items: { task: number; level: CefrLevel }[]): CefrLevel | null {
  if (items.length === 0) return null;
  const sorted = items
    .map((i) => ({ score: levelScore(i.level), w: TASK_WEIGHT[i.task] ?? 1 }))
    .sort((a, b) => a.score - b.score);
  const total = sorted.reduce((s, i) => s + i.w, 0);
  let acc = 0;
  for (const item of sorted) {
    acc += item.w;
    if (acc >= total / 2) return scoreToLevel(item.score);
  }
  return scoreToLevel(sorted[sorted.length - 1].score);
}
