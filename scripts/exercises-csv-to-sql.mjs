#!/usr/bin/env node
/**
 * `pnpm exercises:seed-sql <csv> --out <file.sql>`: builds exercise-bank SQL (sessions,
 * exercises, aliases, occurrences; idempotent upserts separated by statement-breakpoint
 * markers) from a CSV export with the columns id,taskType,content,url,imageUrl,imagePath,
 * isImageBased. Logic: scripts/lib/exercise-seed-sql.mjs. `pnpm exercises:load` applies the
 * result to an empty bank.
 *
 * Two banks use it: the public sample (packages/db/seed/sample-exercises.csv →
 * sample-exercise-bank.sql) and the real bank, which lives in the private repository
 * yortyrh/parle-tcf-data. New subjects arrive through `pnpm exercises:import`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { buildExerciseSeedSql } from './lib/exercise-seed-sql.mjs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
const csv = args.find((a, i) => !a.startsWith('--') && i !== outIndex + 1);
if (!csv || !out) {
  console.error('usage: pnpm exercises:seed-sql <path/to/exercises.csv> --out <path/to/bank.sql>');
  process.exit(1);
}

const rows = parse(readFileSync(csv), { columns: true, skip_empty_lines: true });
const sql = buildExerciseSeedSql(rows);
const target = resolve(process.env.INIT_CWD ?? process.cwd(), out);
writeFileSync(target, sql);
console.log(
  `exercises:seed-sql: ${rows.length} CSV rows → ${relative(process.cwd(), target)} (${Math.round(sql.length / 1024)} KB)`
);
