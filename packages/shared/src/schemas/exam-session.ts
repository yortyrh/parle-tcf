import { z } from "zod";

export const taskTypeSchema = z.enum(["tache1", "tache2", "tache3"]);

export const attemptModeSchema = z.enum(["practice", "full"]);

export const createExamSessionInputSchema = z.object({
  taskType: taskTypeSchema,
  exerciseId: z.string().optional(),
  /** `full` chains the three tasks of an exam under one run. */
  mode: attemptModeSchema.default("practice"),
  /** Existing run to attach to (full mode, tasks 2 and 3). */
  runId: z.string().uuid().optional(),
});

export const exerciseDataPayloadSchema = z.object({
  title: z.string(),
  description: z.string(),
  content: z.string().optional(),
  exerciseId: z.string().optional(),
  taskType: z.string().optional(),
  /** Picture the subject relies on (some older Tâche 2 subjects). */
  imageUrl: z.string().url().optional(),
  /** Tâche 2: the role-play situation and the candidate's instruction, when known. */
  scenario: z.string().optional(),
  instruction: z.string().optional(),
});

export const agentConfigForClientSchema = z.object({
  instructions: z.string(),
  greeting: z.string(),
  voice: z.string(),
  model: z.string(),
  allowInterruptions: z.boolean(),
});

export const createExamSessionOutputSchema = z.object({
  /** Voice backend the browser must connect to. */
  provider: z.enum(["openai", "gemini"]).default("openai"),
  clientSecret: z.string(),
  sessionId: z.string(),
  /** Persisted attempt this session records into. */
  attemptId: z.string().uuid(),
  runId: z.string().uuid().nullable(),
  exerciseData: exerciseDataPayloadSchema,
  agentConfig: agentConfigForClientSchema,
  /** Ordered exercise ids for this task type (empty for tache1). Enables next/random navigation in the client. */
  orderedExerciseIds: z.array(z.string()).optional(),
});

export type AttemptMode = z.infer<typeof attemptModeSchema>;
/** Input as sent by clients (defaults not yet applied). */
export type CreateExamSessionRequest = z.input<
  typeof createExamSessionInputSchema
>;
export type CreateExamSessionInput = z.infer<
  typeof createExamSessionInputSchema
>;
export type CreateExamSessionOutput = z.infer<
  typeof createExamSessionOutputSchema
>;
export type ExerciseData = z.infer<typeof exerciseDataPayloadSchema>;
