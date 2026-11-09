import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, type LanguageModel } from "ai";
import {
  and,
  eq,
  evaluations,
  examAttempts,
  examRuns,
  exercises,
  lt,
  sql,
  transcripts,
  type Database,
  type TranscriptError,
} from "@parle-tcf/db";
import {
  estimateCost,
  evaluationOutputSchema,
  weightedMedianLevel,
  type CefrLevel,
  type EvaluationOutput,
} from "@parle-tcf/shared";
import { DATABASE } from "../database/database.tokens.js";
import { ProviderSettingsService } from "../settings/provider-settings.service.js";
import { loadRubric, RUBRIC_VERSION } from "./rubric.js";

export const LANGUAGE_MODEL_FACTORY = Symbol("LANGUAGE_MODEL_FACTORY");
export type LanguageModelFactory = (
  apiKey: string,
  modelId: string,
) => LanguageModel;

export const openAiModelFactory: LanguageModelFactory = (apiKey, modelId) =>
  createOpenAI({ apiKey })(modelId);

export const DEFAULT_TEXT_MODEL = "gpt-4o-mini";
const MAX_ATTEMPTS = 3; // first try + 2 retries
const STALE_RUNNING_MS = 5 * 60_000;

export interface EvaluationRunResult {
  output: EvaluationOutput;
  inputTokens: number;
  outputTokens: number;
}

/** Locates each faulty excerpt inside the original text (first match). */
export function locateErrors(
  text: string,
  errors: EvaluationOutput["utterances"][number]["errors"],
): TranscriptError[] {
  const located: TranscriptError[] = [];
  for (const e of errors) {
    const start = text.indexOf(e.excerpt);
    if (start < 0) continue; // model paraphrased: drop rather than mislead
    located.push({
      start,
      end: start + e.excerpt.length,
      type: e.type,
      explanation: e.explanation,
    });
  }
  return located;
}

@Injectable()
export class EvaluationService implements OnModuleInit {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly settings: ProviderSettingsService,
    @Inject(LANGUAGE_MODEL_FACTORY)
    private readonly modelFactory: LanguageModelFactory,
  ) {}

  /** Evaluations left "running" by a crashed process must not stay stuck. */
  async onModuleInit(): Promise<void> {
    await this.failStale();
  }

  async failStale(): Promise<void> {
    await this.db
      .update(examAttempts)
      .set({ evaluationStatus: "failed" })
      .where(
        and(
          eq(examAttempts.evaluationStatus, "running"),
          lt(examAttempts.finishedAt, new Date(Date.now() - STALE_RUNNING_MS)),
        ),
      );
  }

  /** Fire-and-forget entry point: never throws, always settles the status. */
  start(userId: string, attemptId: string): void {
    void this.evaluate(userId, attemptId).catch((error: unknown) =>
      this.logger.error(
        `Evaluation crashed for attempt ${attemptId}: ${String(error)}`,
      ),
    );
  }

  async evaluate(userId: string, attemptId: string): Promise<void> {
    const [attempt] = await this.db
      .select()
      .from(examAttempts)
      .where(
        and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)),
      )
      .limit(1);
    if (!attempt || attempt.status !== "completed") return;

    await this.db
      .update(examAttempts)
      .set({ evaluationStatus: "running" })
      .where(eq(examAttempts.id, attemptId));

    try {
      const config = await this.settings.getConfigForUser(userId);
      const lines = await this.db
        .select()
        .from(transcripts)
        .where(eq(transcripts.attemptId, attemptId))
        .orderBy(transcripts.seq);
      const candidate = lines.filter((l) => l.speaker === "candidate");
      if (candidate.length === 0) throw new Error("No candidate speech.");

      const [exercise] = attempt.exerciseId
        ? await this.db
            .select({ prompt: exercises.prompt })
            .from(exercises)
            .where(eq(exercises.id, attempt.exerciseId))
            .limit(1)
        : [];

      const modelId = config.textModel ?? DEFAULT_TEXT_MODEL;
      const startedAt = Date.now();
      const result = await this.run(
        this.modelFactory(config.apiKey, modelId),
        buildPrompt(attempt.task, exercise?.prompt ?? null, lines),
      );
      const latencyMs = Date.now() - startedAt;

      await this.save({
        userId,
        attempt,
        modelId,
        result,
        latencyMs,
        lines,
      });
    } catch (error) {
      this.logger.warn(
        `Evaluation failed for attempt ${attemptId}: ${error instanceof Error ? error.message : "unknown"}`,
      );
      await this.db
        .update(examAttempts)
        .set({ evaluationStatus: "failed" })
        .where(eq(examAttempts.id, attemptId));
    }
  }

  /** Up to 2 retries when the output is missing or does not match the schema. */
  async run(
    model: LanguageModel,
    prompt: string,
  ): Promise<EvaluationRunResult> {
    let lastError: unknown;
    let inputTokens = 0;
    let outputTokens = 0;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      try {
        const res = await generateText({
          model,
          system: loadRubric(),
          prompt,
          temperature: 0,
          output: Output.object({ schema: evaluationOutputSchema }),
        });
        inputTokens += res.usage.inputTokens ?? 0;
        outputTokens += res.usage.outputTokens ?? 0;
        return { output: res.output, inputTokens, outputTokens };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Evaluation failed");
  }

  private async save(params: {
    userId: string;
    attempt: typeof examAttempts.$inferSelect;
    modelId: string;
    result: EvaluationRunResult;
    latencyMs: number;
    lines: (typeof transcripts.$inferSelect)[];
  }): Promise<void> {
    const { attempt, modelId, result, lines } = params;
    const { output } = result;
    const byseq = new Map(output.utterances.map((u) => [u.seq, u]));

    await this.db.transaction(async (tx) => {
      const values = {
        globalLevel: output.globalLevel,
        levels: output.criteria,
        comments: { summary: output.summary },
        correctorModel: modelId,
        rubricVersion: RUBRIC_VERSION,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: params.latencyMs,
      };
      await tx
        .insert(evaluations)
        .values({ attemptId: attempt.id, ...values })
        .onConflictDoUpdate({ target: evaluations.attemptId, set: values });

      for (const line of lines) {
        if (line.speaker !== "candidate") continue;
        const u = byseq.get(line.seq);
        if (!u) continue;
        await tx
          .update(transcripts)
          .set({
            correctedText: u.corrected,
            errors: locateErrors(line.text, u.errors),
          })
          .where(eq(transcripts.id, line.id));
      }

      const evalCost =
        estimateCost(modelId, result.inputTokens, result.outputTokens) ?? 0;
      await tx
        .update(examAttempts)
        .set({
          evaluationStatus: "done",
          // evaluation cost adds to the realtime cost already stored
          estimatedCostUsd: sql`coalesce(${examAttempts.estimatedCostUsd}, 0) + ${evalCost.toFixed(4)}`,
        })
        .where(eq(examAttempts.id, attempt.id));
    });

    if (attempt.runId) await this.updateRunLevel(attempt.runId);
  }

  /** Overall level of a full exam: weighted median once all tasks are graded. */
  async updateRunLevel(runId: string): Promise<void> {
    const rows = await this.db
      .select({
        task: examAttempts.task,
        level: evaluations.globalLevel,
      })
      .from(examAttempts)
      .innerJoin(evaluations, eq(evaluations.attemptId, examAttempts.id))
      .where(
        and(
          eq(examAttempts.runId, runId),
          eq(examAttempts.status, "completed"),
        ),
      );
    const tasks = new Set(rows.map((r) => r.task));
    if (![1, 2, 3].every((t) => tasks.has(t))) return;
    const level = weightedMedianLevel(
      rows.map((r) => ({ task: r.task, level: r.level as CefrLevel })),
    );
    await this.db
      .update(examRuns)
      .set({ globalLevel: level, finishedAt: new Date() })
      .where(eq(examRuns.id, runId));
  }

  /** Re-queues a failed (or done) evaluation. Returns false if not found. */
  async requeue(userId: string, attemptId: string): Promise<boolean> {
    const [row] = await this.db
      .update(examAttempts)
      .set({ evaluationStatus: "pending" })
      .where(
        and(
          eq(examAttempts.id, attemptId),
          eq(examAttempts.userId, userId),
          eq(examAttempts.status, "completed"),
        ),
      )
      .returning({ id: examAttempts.id });
    if (!row) return false;
    this.start(userId, attemptId);
    return true;
  }
}

function buildPrompt(
  task: number,
  exercisePrompt: string | null,
  lines: { seq: number; speaker: string; text: string }[],
): string {
  const transcript = lines
    .map(
      (l) =>
        `[${l.seq}] ${l.speaker === "candidate" ? "CANDIDAT" : "EXAMINATEUR"} : ${l.text}`,
    )
    .join("\n");
  return [
    `Tâche ${task} du TCF.`,
    exercisePrompt ? `Consigne / sujet :\n${exercisePrompt}` : null,
    `Transcription (issue d'une reconnaissance vocale) :\n${transcript}`,
    "Évalue le candidat selon la rubrique.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
