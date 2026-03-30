import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TCFExercise {
  id: string;
  taskType: 'Tâche 2' | 'Tâche 3';
  content: string;
  consigne?: string;
  url?: string;
  imageUrl?: string;
  imagePath?: string;
  isImageBased: boolean;
}

interface ExerciseRow {
  id: string;
  taskType: string;
  content: string;
  url: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  isImageBased: number;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const dbPath = join(__dirname, '../../config/tcf-exercises.db');
    db = new Database(dbPath, { readonly: true });
  }
  return db;
}

function rowToExercise(row: ExerciseRow): TCFExercise {
  const exercise: TCFExercise = {
    id: row.id,
    taskType: row.taskType as 'Tâche 2' | 'Tâche 3',
    content: row.content,
    isImageBased: row.isImageBased === 1,
  };
  if (row.url) exercise.url = row.url;
  if (row.imageUrl) exercise.imageUrl = row.imageUrl;
  if (row.imagePath) exercise.imagePath = row.imagePath;
  return exercise;
}

function taskTypeToLabel(taskType: 'tache2' | 'tache3'): string {
  return taskType === 'tache2' ? 'Tâche 2' : 'Tâche 3';
}

/**
 * Returns a random exercise for the given task type by querying SQLite.
 * Only one row is loaded into memory.
 */
export function getRandomExercise(taskType: 'tache2' | 'tache3'): TCFExercise | null {
  try {
    const label = taskTypeToLabel(taskType);
    const stmt = getDb().prepare<[string], ExerciseRow>(
      'SELECT * FROM exercises WHERE taskType = ? ORDER BY RANDOM() LIMIT 1',
    );
    const row = stmt.get(label);
    if (!row) {
      console.warn(`No exercises found for ${taskType}`);
      return null;
    }
    return rowToExercise(row);
  } catch (error) {
    console.error(`Error fetching random exercise for ${taskType}:`, error);
    return null;
  }
}

/**
 * Returns all exercises for the given task type.
 */
export function getAllExercises(taskType: 'tache2' | 'tache3'): TCFExercise[] {
  try {
    const label = taskTypeToLabel(taskType);
    const stmt = getDb().prepare<[string], ExerciseRow>(
      'SELECT * FROM exercises WHERE taskType = ?',
    );
    return stmt.all(label).map(rowToExercise);
  } catch (error) {
    console.error(`Error fetching all exercises for ${taskType}:`, error);
    return [];
  }
}
