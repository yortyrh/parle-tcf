import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { count } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TACHE1_ENTRETIEN_ID, contentHash } from './exercise-bank';
import { MIGRATIONS_FOLDER } from './migrate';
import { exerciseAliases, exerciseOccurrences, exerciseSessions, exercises } from './schema';
import { type TestDb, createTestDb } from './testing';

const T1_PROMPT =
  'Entretien dirigé : présentation de soi, puis questions sur des sujets quotidiens.';

// The real exercise bank lives in a private repository and is loaded after the
// migrations (see exercise-bank-loader.ts): the migrations only create its tables
// and the fixed tâche 1 row.
describe('exercise bank after all migrations (structure only, no bank data)', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());

  it('has no tâche 2 or 3 subject, session, occurrence or alias', async () => {
    const db = testDb.db;
    const [occ] = await db.select({ n: count() }).from(exerciseOccurrences);
    const [ali] = await db.select({ n: count() }).from(exerciseAliases);
    const [ses] = await db.select({ n: count() }).from(exerciseSessions);
    expect(occ.n).toBe(0);
    expect(ali.n).toBe(0);
    expect(ses.n).toBe(0);
    const rows = await db.select({ task: exercises.task }).from(exercises);
    expect(rows.filter((r) => r.task === 2 || r.task === 3)).toEqual([]);
  });

  it('stores exactly one exercise: the tâche 1 interview row', async () => {
    const rows = await testDb.db.select().from(exercises);
    expect(rows).toHaveLength(1);
    const [t1] = rows;
    expect(t1.id).toBe(TACHE1_ENTRETIEN_ID);
    expect(t1.task).toBe(1);
    expect(t1.prompt).toBe(T1_PROMPT);
    expect(t1.contentHash).toBe(contentHash(T1_PROMPT));
  });

  it.each(readdirSync(MIGRATIONS_FOLDER).filter((f) => f.endsWith('.sql')))(
    'ships no bank data in %s',
    (file) => {
      const sql = readFileSync(join(MIGRATIONS_FOLDER, file), 'utf8');
      expect(sql).not.toMatch(/\d{4}-\d{2}-t[23]-p\d{3}-s\d{3}/);
      expect(sql).not.toMatch(/reussir-tcfcanada/i);
      expect(sql).not.toMatch(/INSERT INTO "exercise_sessions"/);
      expect(sql).not.toMatch(/INSERT INTO "exercise_occurrences"/);
      expect(sql).not.toMatch(/INSERT INTO "exercise_aliases"/);
    }
  );
});
