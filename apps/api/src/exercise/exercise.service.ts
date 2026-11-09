import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, exercises, sql, type Database } from "@parle-tcf/db";
import type { TaskType } from "@parle-tcf/shared";
import { DATABASE } from "../database/database.tokens.js";

export interface TcfExerciseRow {
  id: string;
  task: number;
  content: string;
  url?: string;
  imageUrl?: string;
  isImageBased: boolean;
}

/** Id of the fixed row standing for the Tâche 1 interview (see the seed). */
export const TACHE1_EXERCISE_ID = "t1-entretien";

const TASK_NUMBER: Record<TaskType, number> = {
  tache1: 1,
  tache2: 2,
  tache3: 3,
};

export function taskNumber(taskType: TaskType): number {
  return TASK_NUMBER[taskType];
}

@Injectable()
export class ExerciseService {
  private readonly logger = new Logger(ExerciseService.name);

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private toRow(row: typeof exercises.$inferSelect): TcfExerciseRow {
    const exercise: TcfExerciseRow = {
      id: row.id,
      task: row.task,
      content: row.prompt,
      isImageBased: row.isImageBased,
    };
    if (row.sourceUrl) exercise.url = row.sourceUrl;
    if (row.imageUrl) exercise.imageUrl = row.imageUrl;
    return exercise;
  }

  async getRandomTcfExercise(
    taskType: "tache2" | "tache3",
  ): Promise<TcfExerciseRow | null> {
    const [row] = await this.db
      .select()
      .from(exercises)
      .where(eq(exercises.task, taskNumber(taskType)))
      .orderBy(sql`random()`)
      .limit(1);
    if (!row) {
      this.logger.warn(`No exercises found for ${taskType}; run pnpm db:seed`);
      return null;
    }
    return this.toRow(row);
  }

  /** Ids of a task's bank in a stable order (used by the "next exercise" navigation). */
  async listOrderedExerciseIds(taskType: TaskType): Promise<string[]> {
    if (taskType === "tache1") return [];
    const rows = await this.db
      .select({ id: exercises.id })
      .from(exercises)
      .where(eq(exercises.task, taskNumber(taskType)))
      .orderBy(sql`length(${exercises.id})`, exercises.id);
    return rows.map((r) => r.id);
  }

  async getExerciseById(id: string): Promise<TcfExerciseRow | null> {
    const [row] = await this.db
      .select()
      .from(exercises)
      .where(eq(exercises.id, id))
      .limit(1);
    return row ? this.toRow(row) : null;
  }

  /**
   * Picks the exercise for a task. A requested id must belong to that task;
   * otherwise it is ignored (null) rather than silently serving another one.
   */
  async resolveExerciseForTask(
    taskType: TaskType,
    exerciseId?: string,
  ): Promise<TcfExerciseRow | null> {
    if (taskType === "tache1") {
      return this.getExerciseById(TACHE1_EXERCISE_ID);
    }
    if (exerciseId) {
      const found = await this.getExerciseById(exerciseId);
      return found && found.task === taskNumber(taskType) ? found : null;
    }
    return this.getRandomTcfExercise(taskType);
  }
}
