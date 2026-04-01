/**
 * Converts config/tcf-exercises.csv to config/tcf-exercises.db (SQLite).
 *
 * Usage: pnpm generate-db
 *
 * The resulting database is the runtime source of exercises; the CSV remains
 * the source of truth and should be committed to version control.
 */
import Database from 'better-sqlite3';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const csvPath = join(__dirname, '../config/tcf-exercises.csv');
const dbPath = join(__dirname, '../config/tcf-exercises.db');

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function main() {
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE exercises (
      id TEXT PRIMARY KEY,
      taskType TEXT NOT NULL,
      content TEXT NOT NULL,
      url TEXT,
      imageUrl TEXT,
      imagePath TEXT,
      isImageBased INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_taskType ON exercises(taskType);
  `);

  const csvContent = readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    console.error('CSV file is empty or has no data rows.');
    process.exit(1);
  }

  const firstLine = lines[0];
  if (!firstLine) {
    console.error('CSV file has no header row.');
    process.exit(1);
  }

  const headers = parseCSVLine(firstLine);
  const idIndex = headers.indexOf('id');
  const taskTypeIndex = headers.indexOf('taskType');
  const contentIndex = headers.indexOf('content');
  const urlIndex = headers.indexOf('url');
  const imageUrlIndex = headers.indexOf('imageUrl');
  const imagePathIndex = headers.indexOf('imagePath');
  const isImageBasedIndex = headers.indexOf('isImageBased');

  if (idIndex === -1 || taskTypeIndex === -1 || contentIndex === -1) {
    console.error('CSV is missing required columns: id, taskType, content');
    process.exit(1);
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO exercises (id, taskType, content, url, imageUrl, imagePath, isImageBased)
    VALUES (@id, @taskType, @content, @url, @imageUrl, @imagePath, @isImageBased)
  `);

  const insertMany = db.transaction(
    (
      rows: {
        id: string;
        taskType: string;
        content: string;
        url: string | null;
        imageUrl: string | null;
        imagePath: string | null;
        isImageBased: number;
      }[],
    ) => {
      for (const row of rows) {
        insert.run(row);
      }
    },
  );

  const rows = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const fields = parseCSVLine(line);
    if (fields.length < 3) {
      skipped++;
      continue;
    }

    const id = fields[idIndex];
    const taskTypeValue = fields[taskTypeIndex];
    const content = fields[contentIndex];

    if (!id || !taskTypeValue || !content) {
      skipped++;
      continue;
    }

    if (taskTypeValue !== 'Tâche 2' && taskTypeValue !== 'Tâche 3') {
      skipped++;
      continue;
    }

    rows.push({
      id,
      taskType: taskTypeValue,
      content,
      url: (urlIndex >= 0 && fields[urlIndex]?.trim()) || null,
      imageUrl: (imageUrlIndex >= 0 && fields[imageUrlIndex]?.trim()) || null,
      imagePath: (imagePathIndex >= 0 && fields[imagePathIndex]?.trim()) || null,
      isImageBased: isImageBasedIndex >= 0 && fields[isImageBasedIndex] === 'TRUE' ? 1 : 0,
    });
  }

  insertMany(rows);

  const total = db.prepare('SELECT COUNT(*) as count FROM exercises').get() as { count: number };
  const tache2 = db
    .prepare("SELECT COUNT(*) as count FROM exercises WHERE taskType = 'Tâche 2'")
    .get() as { count: number };
  const tache3 = db
    .prepare("SELECT COUNT(*) as count FROM exercises WHERE taskType = 'Tâche 3'")
    .get() as { count: number };

  db.close();

  console.log(`[generate-db] Done. ${rows.length} rows inserted, ${skipped} skipped.`);
  console.log(
    `[generate-db] Total: ${total.count} | Tâche 2: ${tache2.count} | Tâche 3: ${tache3.count}`,
  );
  console.log(`[generate-db] Database written to: ${dbPath}`);
}

main();
