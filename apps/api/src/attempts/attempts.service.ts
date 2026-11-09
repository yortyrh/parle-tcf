import { Inject, Injectable } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
import {
  and,
  count,
  desc,
  eq,
  examAttempts,
  examRuns,
  exercises,
  sql,
  transcripts,
  type Database,
  type DbExecutor,
} from "@parle-tcf/db";
import type {
  AttemptDetail,
  AttemptMode,
  AttemptSummary,
  CompleteAttemptInput,
  ListAttemptsInput,
  ListAttemptsOutput,
  TranscriptLine,
} from "@parle-tcf/shared";
import { DATABASE } from "../database/database.tokens.js";

type AttemptRow = typeof examAttempts.$inferSelect;

export interface CreateAttemptParams {
  userId: string;
  mode: AttemptMode;
  runId: string | null;
  exerciseId: string | null;
  task: number;
  model: string;
}

function toSummary(row: AttemptRow): AttemptSummary {
  return {
    id: row.id,
    runId: row.runId,
    mode: row.mode,
    task: row.task,
    exerciseId: row.exerciseId,
    status: row.status,
    evaluationStatus: row.evaluationStatus,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    durationS: row.durationS,
    model: row.model,
  };
}

/**
 * Every read and write goes through a `user_id` filter: an attempt that
 * belongs to someone else is indistinguishable from one that does not exist.
 */
@Injectable()
export class AttemptsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private notFound(): never {
    throw new ORPCError("NOT_FOUND", { message: "Tentative introuvable." });
  }

  private async findOwned(
    userId: string,
    attemptId: string,
    executor: DbExecutor = this.db,
  ): Promise<AttemptRow> {
    const [row] = await executor
      .select()
      .from(examAttempts)
      .where(
        and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)),
      )
      .limit(1);
    return row ?? this.notFound();
  }

  /** Creates (or reuses, in full mode) the run, then the in-progress attempt. */
  async create(params: CreateAttemptParams): Promise<AttemptRow> {
    return this.db.transaction(async (tx) => {
      let runId = params.runId;
      if (params.mode === "full") {
        if (runId) {
          const [run] = await tx
            .select({ id: examRuns.id })
            .from(examRuns)
            .where(
              and(eq(examRuns.id, runId), eq(examRuns.userId, params.userId)),
            )
            .limit(1);
          if (!run) this.notFound();
        } else {
          const [run] = await tx
            .insert(examRuns)
            .values({ userId: params.userId, mode: "full" })
            .returning({ id: examRuns.id });
          runId = run!.id;
        }
      } else {
        runId = null;
      }

      const [attempt] = await tx
        .insert(examAttempts)
        .values({
          userId: params.userId,
          runId,
          mode: params.mode,
          exerciseId: params.exerciseId,
          task: params.task,
          provider: "openai",
          model: params.model,
        })
        .returning();
      return attempt!;
    });
  }

  private async saveLines(
    tx: DbExecutor,
    attemptId: string,
    lines: TranscriptLine[],
  ): Promise<void> {
    if (lines.length === 0) return;
    await tx
      .insert(transcripts)
      .values(lines.map((l) => ({ attemptId, ...l })))
      .onConflictDoUpdate({
        target: [transcripts.attemptId, transcripts.seq],
        set: { text: sql`excluded.text`, speaker: sql`excluded.speaker` },
      });
  }

  /** Idempotent by `seq`: replays and overlapping batches are harmless. */
  async checkpoint(
    userId: string,
    attemptId: string,
    lines: TranscriptLine[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.findOwned(userId, attemptId, tx);
      await this.saveLines(tx, attemptId, lines);
    });
  }

  async complete(userId: string, input: CompleteAttemptInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.findOwned(userId, input.attemptId, tx);
      await this.saveLines(tx, input.attemptId, input.lines);
      await tx
        .update(examAttempts)
        .set({
          status: "completed",
          finishedAt: new Date(),
          durationS: input.durationS,
          realtimeMinutes: (input.durationS / 60).toFixed(2),
          inputTokens: input.usage?.inputTokens ?? null,
          outputTokens: input.usage?.outputTokens ?? null,
        })
        .where(
          and(
            eq(examAttempts.id, input.attemptId),
            eq(examAttempts.userId, userId),
          ),
        );
    });
  }

  async list(
    userId: string,
    input: ListAttemptsInput,
  ): Promise<ListAttemptsOutput> {
    const limit = input.limit ?? 20;
    const offset = input.offset ?? 0;
    const where = and(
      eq(examAttempts.userId, userId),
      input.task ? eq(examAttempts.task, input.task) : undefined,
      input.mode ? eq(examAttempts.mode, input.mode) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(examAttempts)
        .where(where)
        .orderBy(desc(examAttempts.startedAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ n: count() }).from(examAttempts).where(where),
    ]);
    return { items: rows.map(toSummary), total: total?.n ?? 0 };
  }

  async get(userId: string, attemptId: string): Promise<AttemptDetail> {
    const attempt = await this.findOwned(userId, attemptId);
    const [lines, exercise] = await Promise.all([
      this.db
        .select()
        .from(transcripts)
        .where(eq(transcripts.attemptId, attemptId))
        .orderBy(transcripts.seq),
      attempt.exerciseId
        ? this.db
            .select({ prompt: exercises.prompt })
            .from(exercises)
            .where(eq(exercises.id, attempt.exerciseId))
            .limit(1)
        : Promise.resolve([]),
    ]);
    return {
      ...toSummary(attempt),
      exercisePrompt: exercise[0]?.prompt ?? null,
      transcript: lines.map((l) => ({
        seq: l.seq,
        speaker: l.speaker,
        text: l.text,
        correctedText: l.correctedText,
      })),
    };
  }

  async delete(userId: string, attemptId: string): Promise<void> {
    await this.findOwned(userId, attemptId);
    await this.db
      .delete(examAttempts)
      .where(
        and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)),
      );
  }
}
