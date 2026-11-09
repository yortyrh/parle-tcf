import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "./client";
import { exercises } from "./schema";

type ExerciseInsert = typeof exercises.$inferInsert;

export interface SeedReport {
  rows: ExerciseInsert[];
  /** Ids that appear more than once in the CSV (first occurrence wins). */
  duplicateIds: string[];
  /** Data rows ignored because of a missing field or an unknown task type. */
  skipped: number;
}

/** Tâche 1 has no exercise bank: a single fixed row stands for the interview. */
export const TACHE1_ENTRETIEN: ExerciseInsert = {
  id: "t1-entretien",
  task: 1,
  theme: null,
  prompt:
    "Entretien dirigé : présentation de soi, puis questions sur des sujets quotidiens.",
};

const TASK_BY_LABEL: Record<string, 2 | 3> = {
  "Tâche 2": 2,
  "Tâche 3": 3,
};

/**
 * Parses `tcf-exercises.csv` (RFC 4180: quoted fields may span several lines).
 * Pure function so it can be tested without a database.
 */
export function parseExerciseCsv(csv: string): SeedReport {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const rows: ExerciseInsert[] = [];
  let skipped = 0;

  records.forEach((record, index) => {
    const id = record.id?.trim();
    const task = TASK_BY_LABEL[record.taskType ?? ""];
    const prompt = record.content?.trim();
    if (!id || !task || !prompt) {
      skipped++;
      return;
    }
    if (seen.has(id)) {
      duplicateIds.push(id);
      return;
    }
    seen.add(id);
    rows.push({
      id,
      task,
      theme: null,
      prompt,
      sourceRow: index + 1,
      sourceUrl: record.url?.trim() || null,
      imageUrl: record.imageUrl?.trim() || null,
      isImageBased: record.isImageBased?.trim().toUpperCase() === "TRUE",
    });
  });

  return { rows, duplicateIds, skipped };
}

const BATCH_SIZE = 500;

/**
 * Idempotent upsert of the whole bank. Re-running it refreshes the text of
 * existing exercises and never touches `theme` (filled by a later script).
 */
export async function seedExercises(
  db: Database,
  report: SeedReport,
): Promise<number> {
  const all = [TACHE1_ENTRETIEN, ...report.rows];
  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);
    await db
      .insert(exercises)
      .values(batch)
      .onConflictDoUpdate({
        target: exercises.id,
        set: {
          task: sqlExcluded("task"),
          prompt: sqlExcluded("prompt"),
          sourceRow: sqlExcluded("source_row"),
          sourceUrl: sqlExcluded("source_url"),
          imageUrl: sqlExcluded("image_url"),
          isImageBased: sqlExcluded("is_image_based"),
        },
      });
  }
  return all.length;
}

function sqlExcluded(column: string) {
  return sql.raw(`excluded."${column}"`);
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const csvPath =
    process.env.EXERCISES_CSV ??
    path.resolve(
      __dirname,
      "..",
      "..",
      "..",
      "apps",
      "api",
      "config",
      "tcf-exercises.csv",
    );
  const report = parseExerciseCsv(readFileSync(csvPath, "utf-8"));
  const handle = createDb({ url, max: 1 });
  seedExercises(handle.db, report)
    .then((count) => {
      console.log(`[seed] ${count} exercises upserted from ${csvPath}`);
      if (report.skipped > 0) {
        console.warn(`[seed] ${report.skipped} CSV rows skipped (invalid)`);
      }
      if (report.duplicateIds.length > 0) {
        console.warn(
          `[seed] ${report.duplicateIds.length} duplicate ids ignored: ${report.duplicateIds.join(", ")}`,
        );
      }
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => handle.close());
}
