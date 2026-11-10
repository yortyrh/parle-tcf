import { Inject, Injectable } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  examAttempts,
  evaluations,
  examRuns,
  exercises,
  lt,
  sql,
  transcripts,
  type Database,
  type DbExecutor,
} from "@parle-tcf/db";
import { estimateCost } from "@parle-tcf/shared";
import type {
  AttemptDetail,
  CefrLevel,
  Evaluation,
  AttemptMode,
  AttemptSummary,
  CompleteAttemptInput,
  ExamRun,
  ListAttemptsInput,
  ListAttemptsOutput,
  TranscriptLine,
} from "@parle-tcf/shared";
import { DATABASE } from "../database/database.tokens.js";

type AttemptRow = typeof examAttempts.$inferSelect;

/** An in-progress attempt with no sign of life for this long is interrupted. */
export const STALE_ATTEMPT_MS = 15 * 60_000;
const MAX_DURATION_S = 60 * 60;

/** Seconds between two instants, clamped to [0, MAX_DURATION_S]. */
function elapsedSeconds(from: Date, to: Date): number {
  const s = Math.round((to.getTime() - from.getTime()) / 1000);
  return Math.min(MAX_DURATION_S, Math.max(0, s));
}

export interface CreateAttemptParams {
  userId: string;
  mode: AttemptMode;
  runId: string | null;
  exerciseId: string | null;
  task: number;
  model: string;
  provider?: "openai" | "gemini";
}

function toSummary(
  row: AttemptRow,
  globalLevel: string | null = null,
): AttemptSummary {
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
    globalLevel: globalLevel as CefrLevel | null,
    estimatedCostUsd:
      row.estimatedCostUsd === null ? null : Number(row.estimatedCostUsd),
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

  async findOwned(
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
          provider: params.provider ?? "openai",
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

  /**
   * Idempotent by `seq`: replays and overlapping batches are harmless. Only an
   * in-progress attempt takes lines (and counts as alive); later ones are ignored.
   */
  async checkpoint(
    userId: string,
    attemptId: string,
    lines: TranscriptLine[],
    now = new Date(),
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const attempt = await this.findOwned(userId, attemptId, tx);
      if (attempt.status !== "in_progress") return;
      await this.saveLines(tx, attemptId, lines);
      await tx
        .update(examAttempts)
        .set({ lastActivityAt: now })
        .where(
          and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)),
        );
    });
  }

  /** The voice session really starts now (after any preparation time). */
  async touchStart(
    userId: string,
    attemptId: string,
    now = new Date(),
  ): Promise<AttemptRow> {
    const attempt = await this.findOwned(userId, attemptId);
    if (attempt.status !== "in_progress") {
      throw new ORPCError("CONFLICT", {
        message: "Cette tentative est déjà terminée.",
      });
    }
    const [row] = await this.db
      .update(examAttempts)
      .set({ startedAt: now, lastActivityAt: now })
      .where(
        and(
          eq(examAttempts.id, attemptId),
          eq(examAttempts.userId, userId),
          eq(examAttempts.status, "in_progress"),
        ),
      )
      .returning();
    return row ?? this.notFound();
  }

  /**
   * Closes the attempt once. Returns true when it moved to `completed` (the
   * caller then starts the evaluation); a second call changes nothing. The
   * duration comes from the server clock, never from the client.
   */
  async complete(
    userId: string,
    input: CompleteAttemptInput,
    now = new Date(),
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const attempt = await this.findOwned(userId, input.attemptId, tx);
      if (attempt.status === "completed") return false;
      await this.saveLines(tx, input.attemptId, input.lines);
      const durationS = elapsedSeconds(attempt.startedAt, now);
      const cost = input.usage
        ? estimateCost(
            attempt.model,
            input.usage.inputTokens,
            input.usage.outputTokens,
          )
        : null;
      await tx
        .update(examAttempts)
        .set({
          status: "completed",
          finishedAt: now,
          lastActivityAt: now,
          durationS,
          realtimeMinutes: (durationS / 60).toFixed(2),
          inputTokens: input.usage?.inputTokens ?? null,
          outputTokens: input.usage?.outputTokens ?? null,
          estimatedCostUsd: cost === null ? null : cost.toFixed(4),
          evaluationStatus: "pending",
        })
        .where(
          and(
            eq(examAttempts.id, input.attemptId),
            eq(examAttempts.userId, userId),
          ),
        );
      return true;
    });
  }

  /**
   * Sessions that vanished (tab closed, crash) stop counting as in progress:
   * they end at their last sign of life. Returns how many were interrupted.
   */
  async interruptStale(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - STALE_ATTEMPT_MS);
    const stale = await this.db
      .select({
        id: examAttempts.id,
        startedAt: examAttempts.startedAt,
        lastActivityAt: examAttempts.lastActivityAt,
      })
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.status, "in_progress"),
          lt(examAttempts.lastActivityAt, cutoff),
        ),
      );
    for (const row of stale) {
      const durationS = elapsedSeconds(row.startedAt, row.lastActivityAt);
      await this.db
        .update(examAttempts)
        .set({
          status: "interrupted",
          finishedAt: row.lastActivityAt,
          durationS,
          realtimeMinutes: (durationS / 60).toFixed(2),
        })
        .where(
          and(
            eq(examAttempts.id, row.id),
            eq(examAttempts.status, "in_progress"),
          ),
        );
    }
    return stale.length;
  }

  /** A full-exam run with its attempts; someone else's run is NOT_FOUND. */
  async getRun(userId: string, runId: string): Promise<ExamRun> {
    const [run] = await this.db
      .select()
      .from(examRuns)
      .where(and(eq(examRuns.id, runId), eq(examRuns.userId, userId)))
      .limit(1);
    if (!run) this.notFound();
    const rows = await this.db
      .select({ attempt: examAttempts, level: evaluations.globalLevel })
      .from(examAttempts)
      .leftJoin(evaluations, eq(evaluations.attemptId, examAttempts.id))
      .where(
        and(eq(examAttempts.runId, runId), eq(examAttempts.userId, userId)),
      )
      .orderBy(asc(examAttempts.task), asc(examAttempts.startedAt));
    return {
      id: run.id,
      mode: run.mode,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      globalLevel: run.globalLevel as CefrLevel | null,
      attempts: rows.map((r) => toSummary(r.attempt, r.level)),
    };
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
        .select({
          attempt: examAttempts,
          level: evaluations.globalLevel,
        })
        .from(examAttempts)
        .leftJoin(evaluations, eq(evaluations.attemptId, examAttempts.id))
        .where(where)
        .orderBy(desc(examAttempts.startedAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ n: count() }).from(examAttempts).where(where),
    ]);
    return {
      items: rows.map((r) => toSummary(r.attempt, r.level)),
      total: total?.n ?? 0,
    };
  }

  async get(userId: string, attemptId: string): Promise<AttemptDetail> {
    const attempt = await this.findOwned(userId, attemptId);
    const [lines, exercise, [evaluation]] = await Promise.all([
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
      this.db
        .select()
        .from(evaluations)
        .where(eq(evaluations.attemptId, attemptId))
        .limit(1),
    ]);
    return {
      ...toSummary(attempt, evaluation?.globalLevel ?? null),
      exercisePrompt: exercise[0]?.prompt ?? null,
      realtimeMinutes:
        attempt.realtimeMinutes === null
          ? null
          : Number(attempt.realtimeMinutes),
      evaluation: evaluation
        ? {
            globalLevel: evaluation.globalLevel as CefrLevel,
            criteria: evaluation.levels as Evaluation["criteria"],
            summary: evaluation.comments?.summary ?? "",
            correctorModel: evaluation.correctorModel,
            rubricVersion: evaluation.rubricVersion,
          }
        : null,
      transcript: lines.map((l) => ({
        seq: l.seq,
        speaker: l.speaker,
        text: l.text,
        correctedText: l.correctedText,
        errors: l.errors,
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
