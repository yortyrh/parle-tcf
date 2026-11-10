#!/usr/bin/env node
/**
 * `pnpm exercises:seed-sql <csv>`: rebuilds the exercise-bank data migration
 * (packages/db/migrations/0003_exercise_bank_data.sql) from a CSV export with the
 * columns id,taskType,content,url,imageUrl,imagePath,isImageBased. Logic:
 * scripts/lib/exercise-seed-sql.mjs. The original CSV lives in git history
 * (apps/api/config/tcf-exercises.csv, removed once migrated). Only regenerate a
 * migration that has not been applied anywhere yet; new subjects arrive through
 * `pnpm exercises:import`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { buildExerciseSeedSql } from "./lib/exercise-seed-sql.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV = process.argv[2];
if (!CSV) {
  console.error("usage: pnpm exercises:seed-sql <path/to/exercises.csv>");
  process.exit(1);
}
const TARGET = join(ROOT, "packages/db/migrations/0003_exercise_bank_data.sql");

const rows = parse(readFileSync(CSV), {
  columns: true,
  skip_empty_lines: true,
});
const sql = buildExerciseSeedSql(rows);
writeFileSync(TARGET, sql);
console.log(
  `exercises:seed-sql: ${rows.length} CSV rows → ${TARGET.replace(`${ROOT}/`, "")} (${Math.round(sql.length / 1024)} KB)`,
);
