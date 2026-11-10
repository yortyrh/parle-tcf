-- Custom SQL migration file, put your code below! --
-- Existing rows: the last known activity is when they finished, or else when they started.
UPDATE "exam_attempts" SET "last_activity_at" = coalesce("finished_at", "started_at");
