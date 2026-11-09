CREATE TYPE "public"."attempt_mode" AS ENUM('full', 'practice');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'completed', 'interrupted');--> statement-breakpoint
CREATE TYPE "public"."evaluation_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('openai', 'gemini');--> statement-breakpoint
CREATE TYPE "public"."speaker" AS ENUM('examiner', 'candidate');--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"global_level" text NOT NULL,
	"levels" jsonb NOT NULL,
	"comments" jsonb,
	"corrector_model" text NOT NULL,
	"rubric_version" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluations_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"run_id" uuid,
	"mode" "attempt_mode" NOT NULL,
	"exercise_id" text,
	"task" smallint NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"evaluation_status" "evaluation_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_s" integer,
	"provider" "provider" NOT NULL,
	"model" text NOT NULL,
	"realtime_minutes" numeric(8, 2),
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_usd" numeric(10, 4),
	"audio_key" text
);
--> statement-breakpoint
CREATE TABLE "exam_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" "attempt_mode" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"global_level" text
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"task" smallint NOT NULL,
	"theme" text,
	"prompt" text NOT NULL,
	"source_row" integer,
	"source_url" text,
	"image_url" text,
	"is_image_based" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"provider" "provider" DEFAULT 'openai' NOT NULL,
	"api_key_ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"key_version" text NOT NULL,
	"last4" text NOT NULL,
	"realtime_model" text,
	"voice" text,
	"text_model" text,
	"verified_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"speaker" "speaker" NOT NULL,
	"text" text NOT NULL,
	"corrected_text" text,
	"errors" jsonb
);
--> statement-breakpoint
CREATE TABLE "usage_limits" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"daily_minutes" integer NOT NULL,
	"monthly_cost_usd" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_attempt_id_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_run_id_exam_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."exam_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_runs" ADD CONSTRAINT "exam_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_settings" ADD CONSTRAINT "provider_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_attempt_id_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_limits" ADD CONSTRAINT "usage_limits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exam_attempts_user_id_idx" ON "exam_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exam_attempts_user_exercise_idx" ON "exam_attempts" USING btree ("user_id","exercise_id");--> statement-breakpoint
CREATE INDEX "exam_attempts_run_id_idx" ON "exam_attempts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "exam_runs_user_id_idx" ON "exam_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exercises_task_idx" ON "exercises" USING btree ("task");--> statement-breakpoint
CREATE UNIQUE INDEX "transcripts_attempt_seq_idx" ON "transcripts" USING btree ("attempt_id","seq");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");