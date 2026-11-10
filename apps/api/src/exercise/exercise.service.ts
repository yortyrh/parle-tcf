import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  and,
  count,
  desc,
  eq,
  exerciseAliases,
  exerciseOccurrences,
  exercises,
  exerciseSessions,
  sql,
  type Database,
  type SQL,
} from "@parle-tcf/db";
import type { TaskType } from "@parle-tcf/shared";
import { DATABASE } from "../database/database.tokens.js";

export interface TcfExerciseRow {
  id: string;
  task: number;
  content: string;
  url?: string;
  imageUrl?: string;
  isImageBased: boolean;
  /** Tâche 2 subjects from imported pages: the situation and the candidate's instruction. */
  scenario?: string;
  instruction?: string;
}

export interface ExerciseSessionSummary {
  id: number;
  year: number;
  month: number;
  tache2: number;
  tache3: number;
}

export interface ExerciseListItem {
  id: string;
  task: number;
  prompt: string;
  firstSeenOn: string | null;
  lastSeenOn: string | null;
  timesPublished: number;
  isImageBased: boolean;
}

export interface ListExercisesInput {
  task: 2 | 3;
  sessionId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

const ACCENTED = "àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ";
const PLAIN = "aaaaaaceeeeiiiinooooouuuuyyoa";

/** Lowercase, accent-free SQL form of a text expression (no unaccent extension needed). */
const folded = (expr: SQL) =>
  sql`translate(lower(${expr}), ${ACCENTED}, ${PLAIN})`;

const foldText = (s: string) =>
  s
    .toLowerCase()
    .split("")
    .map((c) => {
      const i = ACCENTED.indexOf(c);
      return i === -1 ? c : PLAIN[i];
    })
    .join("");

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
    if (row.scenario) exercise.scenario = row.scenario;
    if (row.instruction) exercise.instruction = row.instruction;
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
      this.logger.warn(
        `No exercises found for ${taskType}; run pnpm db:migrate`,
      );
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

  /** Also resolves ids merged into another exercise (`exercise_aliases`). */
  async getExerciseById(id: string): Promise<TcfExerciseRow | null> {
    const [row] = await this.db
      .select()
      .from(exercises)
      .where(eq(exercises.id, id))
      .limit(1);
    if (row) return this.toRow(row);
    const [alias] = await this.db
      .select({ exercise: exercises })
      .from(exerciseAliases)
      .innerJoin(exercises, eq(exercises.id, exerciseAliases.exerciseId))
      .where(eq(exerciseAliases.aliasId, id))
      .limit(1);
    return alias ? this.toRow(alias.exercise) : null;
  }

  /** Months with published subjects, newest first, with distinct subjects per task. */
  async listSessions(): Promise<ExerciseSessionSummary[]> {
    const distinctFor = (task: number) =>
      sql<number>`count(distinct ${exerciseOccurrences.exerciseId}) filter (where ${exerciseOccurrences.task} = ${task})`.mapWith(
        Number,
      );
    return this.db
      .select({
        id: exerciseSessions.id,
        year: exerciseSessions.year,
        month: exerciseSessions.month,
        tache2: distinctFor(2),
        tache3: distinctFor(3),
      })
      .from(exerciseSessions)
      .innerJoin(
        exerciseOccurrences,
        eq(exerciseOccurrences.sessionId, exerciseSessions.id),
      )
      .groupBy(exerciseSessions.id)
      .orderBy(desc(exerciseSessions.year), desc(exerciseSessions.month));
  }

  /** Topic browser: a task's subjects, optionally of one month and/or matching a search. */
  async listExercises({
    task,
    sessionId,
    search,
    limit = 20,
    offset = 0,
  }: ListExercisesInput): Promise<{
    items: ExerciseListItem[];
    total: number;
  }> {
    const conditions: SQL[] = [eq(exercises.task, task)];
    if (sessionId !== undefined) {
      conditions.push(
        sql`exists (select 1 from ${exerciseOccurrences} where ${exerciseOccurrences.exerciseId} = ${exercises.id} and ${exerciseOccurrences.sessionId} = ${sessionId})`,
      );
    }
    const term = search?.trim();
    if (term) {
      const pattern = `%${foldText(term).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(sql`${folded(sql`${exercises.prompt}`)} like ${pattern}`);
    }
    const where = and(...conditions);
    const pageSize = Math.min(100, Math.max(1, Math.trunc(limit)));
    const skip = Math.max(0, Math.trunc(offset));

    const timesPublished =
      sql<number>`(select count(*) from ${exerciseOccurrences} where ${exerciseOccurrences.exerciseId} = ${exercises.id})`.mapWith(
        Number,
      );
    const [items, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: exercises.id,
          task: exercises.task,
          prompt: exercises.prompt,
          firstSeenOn: exercises.firstSeenOn,
          lastSeenOn: exercises.lastSeenOn,
          timesPublished,
          isImageBased: exercises.isImageBased,
        })
        .from(exercises)
        .where(where)
        .orderBy(sql`${exercises.lastSeenOn} desc nulls last`, exercises.id)
        .limit(pageSize)
        .offset(skip),
      this.db.select({ total: count() }).from(exercises).where(where),
    ]);
    return { items, total };
  }

  /**
   * Public teaser for the landing page: a few subjects of each task from the
   * latest month (tâche 2 first, in the topic browser's order).
   */
  async featured(perTask = 3): Promise<{
    session: ExerciseSessionSummary | null;
    items: ExerciseListItem[];
  }> {
    const [session] = await this.listSessions();
    if (!session) return { session: null, items: [] };
    const [t2, t3] = await Promise.all(
      ([2, 3] as const).map((task) =>
        this.listExercises({ task, sessionId: session.id, limit: perTask }),
      ),
    );
    return { session, items: [...t2!.items, ...t3!.items] };
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
