CREATE TYPE "public"."import_run_status" AS ENUM('running', 'success', 'partial', 'blocked', 'failed');--> statement-breakpoint
CREATE TABLE "exercise_aliases" (
	"alias_id" text PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_occurrences" (
	"source_ref" text PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL,
	"session_id" integer NOT NULL,
	"task" smallint NOT NULL,
	"part" smallint NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"source_url" text,
	"fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "import_run_status" DEFAULT 'running' NOT NULL,
	"trigger" text NOT NULL,
	"sessions_scanned" integer DEFAULT 0 NOT NULL,
	"inserted" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"occurrences" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "content_html" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "scenario" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "instruction" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "first_seen_on" date;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "last_seen_on" date;--> statement-breakpoint
ALTER TABLE "exercise_aliases" ADD CONSTRAINT "exercise_aliases_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_occurrences" ADD CONSTRAINT "exercise_occurrences_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_occurrences" ADD CONSTRAINT "exercise_occurrences_session_id_exercise_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."exercise_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_occurrences_exercise_idx" ON "exercise_occurrences" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "exercise_occurrences_session_idx" ON "exercise_occurrences" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_sessions_year_month_uq" ON "exercise_sessions" USING btree ("year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_task_content_hash_uq" ON "exercises" USING btree ("task","content_hash");