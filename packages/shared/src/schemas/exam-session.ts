import { z } from "zod";

export const taskTypeSchema = z.enum(["tache1", "tache2", "tache3"]);

export const createExamSessionInputSchema = z.object({
  taskType: taskTypeSchema,
  exerciseId: z.string().optional(),
});

export const exerciseDataPayloadSchema = z.object({
  title: z.string(),
  description: z.string(),
  content: z.string().optional(),
  exerciseId: z.string().optional(),
  taskType: z.string().optional(),
});

export const agentConfigForClientSchema = z.object({
  instructions: z.string(),
  greeting: z.string(),
  voice: z.string(),
  model: z.string(),
  allowInterruptions: z.boolean(),
});

export const createExamSessionOutputSchema = z.object({
  clientSecret: z.string(),
  sessionId: z.string(),
  exerciseData: exerciseDataPayloadSchema,
  agentConfig: agentConfigForClientSchema,
  /** Ordered exercise ids for this task type (empty for tache1). Enables next/random navigation in the client. */
  orderedExerciseIds: z.array(z.string()).optional(),
});

export type CreateExamSessionInput = z.infer<
  typeof createExamSessionInputSchema
>;
export type CreateExamSessionOutput = z.infer<
  typeof createExamSessionOutputSchema
>;
export type ExerciseData = z.infer<typeof exerciseDataPayloadSchema>;
