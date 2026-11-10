import { z } from "zod";
import { attemptModeSchema } from "./exam-session";
import {
  cefrLevelSchema,
  evaluationSchema,
  transcriptErrorSchema,
} from "./evaluation";

export const speakerSchema = z.enum(["examiner", "candidate"]);

export const transcriptLineSchema = z.object({
  seq: z.number().int().nonnegative(),
  speaker: speakerSchema,
  text: z.string().min(1).max(20_000),
});

const linesSchema = z.array(transcriptLineSchema).max(1000);

export const attemptIdInputSchema = z.object({
  attemptId: z.string().uuid(),
});

export const checkpointAttemptInputSchema = z.object({
  attemptId: z.string().uuid(),
  lines: linesSchema,
});

export const checkpointAttemptOutputSchema = z.object({
  ok: z.literal(true),
  /** The daily or monthly limit is reached: the client ends the session. */
  limitReached: z.boolean(),
});

/** The duration is computed by the server from the attempt's timestamps. */
export const completeAttemptInputSchema = z.object({
  attemptId: z.string().uuid(),
  lines: linesSchema,
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    })
    .optional(),
});

export const attemptStatusSchema = z.enum([
  "in_progress",
  "completed",
  "interrupted",
]);
export const evaluationStatusSchema = z.enum([
  "pending",
  "running",
  "done",
  "failed",
]);

export const attemptSummarySchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid().nullable(),
  mode: attemptModeSchema,
  task: z.number().int().min(1).max(3),
  exerciseId: z.string().nullable(),
  status: attemptStatusSchema,
  evaluationStatus: evaluationStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  durationS: z.number().nullable(),
  model: z.string(),
  globalLevel: cefrLevelSchema.nullable(),
  estimatedCostUsd: z.number().nullable(),
});

export const attemptDetailSchema = attemptSummarySchema.extend({
  exercisePrompt: z.string().nullable(),
  realtimeMinutes: z.number().nullable(),
  evaluation: evaluationSchema.nullable(),
  transcript: z.array(
    transcriptLineSchema.extend({
      correctedText: z.string().nullable(),
      errors: z.array(transcriptErrorSchema).nullable(),
    }),
  ),
});

export const listAttemptsInputSchema = z.object({
  task: z.number().int().min(1).max(3).optional(),
  mode: attemptModeSchema.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const listAttemptsOutputSchema = z.object({
  items: z.array(attemptSummarySchema),
  total: z.number().int(),
});

export const getRunInputSchema = z.object({ runId: z.string().uuid() });

/** A full-exam run: its three attempts and, once all are graded, the overall level. */
export const examRunSchema = z.object({
  id: z.string().uuid(),
  mode: attemptModeSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  globalLevel: cefrLevelSchema.nullable(),
  attempts: z.array(attemptSummarySchema),
});

export const usageSchema = z.object({
  todayMinutes: z.number(),
  dailyMinutesLimit: z.number(),
  monthCostUsd: z.number(),
  monthlyCostLimitUsd: z.number(),
});
export type Usage = z.infer<typeof usageSchema>;

export const okOutputSchema = z.object({ ok: z.literal(true) });

export type TranscriptLine = z.infer<typeof transcriptLineSchema>;
export type CheckpointAttemptInput = z.infer<
  typeof checkpointAttemptInputSchema
>;
export type CheckpointAttemptOutput = z.infer<
  typeof checkpointAttemptOutputSchema
>;
export type CompleteAttemptInput = z.infer<typeof completeAttemptInputSchema>;
export type GetRunInput = z.infer<typeof getRunInputSchema>;
export type ExamRun = z.infer<typeof examRunSchema>;
export type AttemptSummary = z.infer<typeof attemptSummarySchema>;
export type AttemptDetail = z.infer<typeof attemptDetailSchema>;
export type ListAttemptsInput = z.input<typeof listAttemptsInputSchema>;
export type ListAttemptsOutput = z.infer<typeof listAttemptsOutputSchema>;
