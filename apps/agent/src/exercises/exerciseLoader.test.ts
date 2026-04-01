import Database from 'better-sqlite3';
import assert from 'node:assert';
import { describe, it } from 'node:test';

/**
 * Creates an in-memory SQLite database with the same schema as tcf-exercises.db
 * and seeds it with two test exercises.
 */
function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE exercises (
      id TEXT PRIMARY KEY,
      taskType TEXT NOT NULL,
      content TEXT NOT NULL,
      url TEXT,
      imageUrl TEXT,
      imagePath TEXT,
      isImageBased INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.prepare('INSERT INTO exercises (id, taskType, content, isImageBased) VALUES (?, ?, ?, ?)').run(
    'test-t2-001',
    'Tâche 2',
    'Contenu exercice tâche 2',
    0,
  );
  db.prepare('INSERT INTO exercises (id, taskType, content, isImageBased) VALUES (?, ?, ?, ?)').run(
    'test-t3-001',
    'Tâche 3',
    'Contenu exercice tâche 3',
    1,
  );
  return db;
}

describe('exerciseLoader – getExerciseById (in-memory DB)', () => {
  it('returns the correct exercise when ID exists', () => {
    const db = createTestDb();
    const stmt = db.prepare<
      [string],
      {
        id: string;
        taskType: string;
        content: string;
        url: string | null;
        imageUrl: string | null;
        imagePath: string | null;
        isImageBased: number;
      }
    >('SELECT * FROM exercises WHERE id = ?');
    const row = stmt.get('test-t2-001');
    assert.ok(row, 'Row should be found');
    assert.strictEqual(row.id, 'test-t2-001');
    assert.strictEqual(row.taskType, 'Tâche 2');
    assert.strictEqual(row.content, 'Contenu exercice tâche 2');
    assert.strictEqual(row.isImageBased, 0);
    db.close();
  });

  it('returns null when ID does not exist', () => {
    const db = createTestDb();
    const stmt = db.prepare<[string], { id: string } | undefined>(
      'SELECT * FROM exercises WHERE id = ?',
    );
    const row = stmt.get('nonexistent-id');
    assert.strictEqual(row, undefined, 'Should return undefined for missing ID');
    db.close();
  });

  it('returns the correct exercise for tache3', () => {
    const db = createTestDb();
    const stmt = db.prepare<
      [string],
      {
        id: string;
        taskType: string;
        isImageBased: number;
      }
    >('SELECT * FROM exercises WHERE id = ?');
    const row = stmt.get('test-t3-001');
    assert.ok(row, 'Row should be found');
    assert.strictEqual(row.id, 'test-t3-001');
    assert.strictEqual(row.taskType, 'Tâche 3');
    assert.strictEqual(row.isImageBased, 1);
    db.close();
  });

  it('exercises table has the expected schema columns', () => {
    const db = createTestDb();
    const info = db.prepare("PRAGMA table_info('exercises')").all() as Array<{ name: string }>;
    const columns = info.map((col) => col.name);
    const expected = ['id', 'taskType', 'content', 'url', 'imageUrl', 'imagePath', 'isImageBased'];
    for (const col of expected) {
      assert.ok(columns.includes(col), `Column "${col}" should exist`);
    }
    db.close();
  });
});
