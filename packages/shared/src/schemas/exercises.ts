import { z } from "zod";

export const listExercisesInputSchema = z.object({
  task: z.union([z.literal(2), z.literal(3)]),
  sessionId: z.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const exerciseListItemSchema = z.object({
  id: z.string(),
  task: z.number().int(),
  prompt: z.string(),
  firstSeenOn: z.string().nullable(),
  lastSeenOn: z.string().nullable(),
  timesPublished: z.number().int(),
  isImageBased: z.boolean(),
});

export const listExercisesOutputSchema = z.object({
  items: z.array(exerciseListItemSchema),
  total: z.number().int(),
});

export const exerciseSessionSchema = z.object({
  id: z.number().int(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  tache2: z.number().int(),
  tache3: z.number().int(),
});

export const listExerciseSessionsOutputSchema = z.object({
  sessions: z.array(exerciseSessionSchema),
});

/** Landing page teaser: the latest month and a few of its subjects. */
export const featuredExercisesOutputSchema = z.object({
  session: exerciseSessionSchema.nullable(),
  items: z.array(exerciseListItemSchema),
});

export type FeaturedExercises = z.infer<typeof featuredExercisesOutputSchema>;
export type ListExercisesInput = z.input<typeof listExercisesInputSchema>;
export type ListExercisesOutput = z.infer<typeof listExercisesOutputSchema>;
export type ExerciseListItem = z.infer<typeof exerciseListItemSchema>;
export type ExerciseSession = z.infer<typeof exerciseSessionSchema>;
