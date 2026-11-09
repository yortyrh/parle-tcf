import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const providerEnum = pgEnum("provider", ["openai", "gemini"]);
export const attemptModeEnum = pgEnum("attempt_mode", ["full", "practice"]);
export const attemptStatusEnum = pgEnum("attempt_status", [
  "in_progress",
  "completed",
  "interrupted",
]);
export const evaluationStatusEnum = pgEnum("evaluation_status", [
  "pending",
  "running",
  "done",
  "failed",
]);
export const speakerEnum = pgEnum("speaker", ["examiner", "candidate"]);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/** Per-user provider credentials. The API key is stored encrypted (AES-256-GCM). */
export const providerSettings = pgTable("provider_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  provider: providerEnum("provider").notNull().default("openai"),
  apiKeyCiphertext: text("api_key_ciphertext").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  keyVersion: text("key_version").notNull(),
  last4: text("last4").notNull(),
  realtimeModel: text("realtime_model"),
  voice: text("voice"),
  textModel: text("text_model"),
  verifiedAt: timestamptz("verified_at"),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Exercise bank, seeded from `apps/api/config/tcf-exercises.csv`. */
export const exercises = pgTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    /** TCF task number: 1, 2 or 3. */
    task: smallint("task").notNull(),
    theme: text("theme"),
    prompt: text("prompt").notNull(),
    sourceRow: integer("source_row"),
    sourceUrl: text("source_url"),
    imageUrl: text("image_url"),
    isImageBased: boolean("is_image_based").notNull().default(false),
  },
  (t) => [index("exercises_task_idx").on(t.task)],
);

/** Groups the three tasks of a full-exam run. */
export const examRuns = pgTable(
  "exam_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mode: attemptModeEnum("mode").notNull(),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
    globalLevel: text("global_level"),
  },
  (t) => [index("exam_runs_user_id_idx").on(t.userId)],
);

/** One row per task attempted. */
export const examAttempts = pgTable(
  "exam_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    runId: uuid("run_id").references(() => examRuns.id, {
      onDelete: "set null",
    }),
    mode: attemptModeEnum("mode").notNull(),
    exerciseId: text("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    task: smallint("task").notNull(),
    status: attemptStatusEnum("status").notNull().default("in_progress"),
    evaluationStatus: evaluationStatusEnum("evaluation_status")
      .notNull()
      .default("pending"),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
    durationS: integer("duration_s"),
    provider: providerEnum("provider").notNull(),
    model: text("model").notNull(),
    realtimeMinutes: numeric("realtime_minutes", { precision: 8, scale: 2 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 10,
      scale: 4,
    }),
    audioKey: text("audio_key"),
  },
  (t) => [
    index("exam_attempts_user_id_idx").on(t.userId),
    index("exam_attempts_user_exercise_idx").on(t.userId, t.exerciseId),
    index("exam_attempts_run_id_idx").on(t.runId),
  ],
);

export interface TranscriptError {
  start: number;
  end: number;
  type: "grammaire" | "lexique" | "syntaxe" | "registre";
  explanation: string;
}

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => examAttempts.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    speaker: speakerEnum("speaker").notNull(),
    text: text("text").notNull(),
    correctedText: text("corrected_text"),
    errors: jsonb("errors").$type<TranscriptError[]>(),
  },
  (t) => [uniqueIndex("transcripts_attempt_seq_idx").on(t.attemptId, t.seq)],
);

export interface CriterionResult {
  level: string;
  comment: string;
}

export const evaluations = pgTable("evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id")
    .notNull()
    .unique()
    .references(() => examAttempts.id, { onDelete: "cascade" }),
  globalLevel: text("global_level").notNull(),
  levels: jsonb("levels").$type<Record<string, CriterionResult>>().notNull(),
  comments: jsonb("comments").$type<Record<string, string>>(),
  correctorModel: text("corrector_model").notNull(),
  rubricVersion: text("rubric_version").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  latencyMs: integer("latency_ms"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const usageLimits = pgTable("usage_limits", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  dailyMinutes: integer("daily_minutes").notNull(),
  monthlyCostUsd: numeric("monthly_cost_usd", {
    precision: 10,
    scale: 2,
  }).notNull(),
});
