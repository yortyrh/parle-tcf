-- Exercise bank data moved out of this public repository (see docs/adr/0006-private-exercise-bank.md):
-- the subjects are loaded by `pnpm exercises:load` / the API pre-deploy step from the private
-- repository yortyrh/parle-tcf-data, or from packages/db/seed/sample-exercise-bank.sql. Databases
-- that already applied the original data migration are unaffected (drizzle only runs newer migrations).
INSERT INTO "exercises" ("id", "task", "prompt", "content_hash") VALUES ('t1-entretien', 1, 'Entretien dirigé : présentation de soi, puis questions sur des sujets quotidiens.', '64ac5c21525375380f42751464bfca82e1983a91fbcf04d1e5b86b2929e21ce7')
ON CONFLICT ("id") DO UPDATE SET "content_hash" = EXCLUDED."content_hash";
--> statement-breakpoint
UPDATE "exercises" SET "content_hash" = 'legacy:' || "id" WHERE "content_hash" IS NULL;
