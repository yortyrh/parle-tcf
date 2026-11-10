import { count, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  TACHE1_ENTRETIEN_ID,
  contentHash,
  normalizeSubjectText,
  parseSourceRef,
  sessionDate,
} from './exercise-bank';
import { exerciseAliases, exerciseOccurrences, exerciseSessions, exercises } from './schema';
import { type TestDb, createTestDb } from './testing';

type Exercise = typeof exercises.$inferSelect;
type Occurrence = typeof exerciseOccurrences.$inferSelect;
type Alias = typeof exerciseAliases.$inferSelect;
type Session = typeof exerciseSessions.$inferSelect;

describe('exercise bank after all migrations (data migrated from the CSV)', () => {
  let testDb: TestDb;
  let allExercises: Exercise[];
  let occurrences: Occurrence[];
  let aliases: Alias[];
  let sessions: Session[];
  let exerciseById: Map<string, Exercise>;

  beforeAll(async () => {
    testDb = await createTestDb();
    allExercises = await testDb.db.select().from(exercises);
    occurrences = await testDb.db.select().from(exerciseOccurrences);
    aliases = await testDb.db.select().from(exerciseAliases);
    sessions = await testDb.db.select().from(exerciseSessions);
    exerciseById = new Map(allExercises.map((e) => [e.id, e]));
  });
  afterAll(() => testDb.close());

  it('has the expected row counts', async () => {
    const db = testDb.db;
    const [ex] = await db.select({ n: count() }).from(exercises);
    const [occ] = await db.select({ n: count() }).from(exerciseOccurrences);
    const [ali] = await db.select({ n: count() }).from(exerciseAliases);
    const [ses] = await db.select({ n: count() }).from(exerciseSessions);
    expect(ex.n).toBe(1657);
    expect(occ.n).toBe(2953);
    expect(ali.n).toBe(1297);
    expect(ses.n).toBe(44);
  });

  it('has no exercise without a content hash', async () => {
    const [row] = await testDb.db
      .select({ n: count() })
      .from(exercises)
      .where(isNull(exercises.contentHash));
    expect(row.n).toBe(0);
  });

  it('keeps counts consistent: occurrences = distinct subjects + aliases', () => {
    const subjects = allExercises.filter((e) => e.id !== TACHE1_ENTRETIEN_ID);
    expect(subjects).toHaveLength(1656);
    expect(subjects.filter((e) => e.task === 2 || e.task === 3)).toHaveLength(1656);
    expect(subjects.length + aliases.length).toBe(occurrences.length);
    expect(new Set(occurrences.map((o) => o.exerciseId)).size).toBe(1656);
  });

  it('stores the tâche 1 interview row', () => {
    const t1 = exerciseById.get(TACHE1_ENTRETIEN_ID);
    expect(t1).toBeDefined();
    expect(t1!.task).toBe(1);
    expect(t1!.prompt).toBe(
      'Entretien dirigé : présentation de soi, puis questions sur des sujets quotidiens.'
    );
    expect(t1!.contentHash).toBe(contentHash(t1!.prompt));
    expect(allExercises.filter((e) => e.task === 1)).toHaveLength(1);
    expect(occurrences.some((o) => o.exerciseId === TACHE1_ENTRETIEN_ID)).toBe(false);
  });

  it('stores normalized prompts whose hash is the stored hash', () => {
    for (const e of allExercises) {
      expect(e.prompt, e.id).toBe(normalizeSubjectText(e.prompt));
      expect(e.prompt.length, e.id).toBeGreaterThan(0);
      expect(e.contentHash, e.id).toBe(contentHash(e.prompt));
    }
    const keys = allExercises.map((e) => `${e.task}:${e.contentHash}`);
    expect(new Set(keys).size).toBe(allExercises.length);
  });

  it('derives task, part, position and session of each occurrence from its ref', () => {
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    for (const o of occurrences) {
      const ref = parseSourceRef(o.sourceRef);
      expect(ref, o.sourceRef).not.toBeNull();
      expect([o.task, o.part, o.position]).toEqual([ref!.task, ref!.part, ref!.position]);
      expect(ref!.task === 2 || ref!.task === 3).toBe(true);
      const session = sessionById.get(o.sessionId);
      expect([session?.year, session?.month]).toEqual([ref!.year, ref!.month]);
      expect(exerciseById.get(o.exerciseId)?.task, o.sourceRef).toBe(o.task);
    }
  });

  it('has one session per month present in the occurrences, each one used', () => {
    const months = new Set(
      occurrences.map((o) => o.sourceRef.slice(0, 7)) // YYYY-MM
    );
    expect(months.size).toBe(44);
    const used = new Set(occurrences.map((o) => o.sessionId));
    for (const s of sessions) expect(used.has(s.id)).toBe(true);
    const keys = sessions.map((s) => `${s.year}-${String(s.month).padStart(2, '0')}`);
    expect(new Set(keys)).toEqual(months);
    for (const s of sessions) expect(s.sourceUrl).toBeTruthy();
  });

  it('names each exercise after the smallest ref of its group and spans its months', () => {
    const refsByExercise = new Map<string, string[]>();
    for (const o of occurrences) {
      const list = refsByExercise.get(o.exerciseId) ?? [];
      list.push(o.sourceRef);
      refsByExercise.set(o.exerciseId, list);
    }
    for (const [exerciseId, refs] of refsByExercise) {
      const sorted = [...refs].sort();
      expect(exerciseId).toBe(sorted[0]);
      const dates = refs
        .map((r) => {
          const p = parseSourceRef(r)!;
          return sessionDate(p.year, p.month);
        })
        .sort();
      const e = exerciseById.get(exerciseId)!;
      expect(e.firstSeenOn, exerciseId).toBe(dates[0]);
      expect(e.lastSeenOn, exerciseId).toBe(dates[dates.length - 1]);
    }
  });

  it('maps every alias to a canonical exercise whose occurrences include the alias', () => {
    const aliasIds = new Set(aliases.map((a) => a.aliasId));
    const occurrenceByRef = new Map(occurrences.map((o) => [o.sourceRef, o]));
    for (const a of aliases) {
      expect(exerciseById.has(a.aliasId), a.aliasId).toBe(false);
      expect(aliasIds.has(a.exerciseId), a.aliasId).toBe(false);
      expect(exerciseById.has(a.exerciseId), a.aliasId).toBe(true);
      expect(a.aliasId > a.exerciseId, a.aliasId).toBe(true);
      expect(occurrenceByRef.get(a.aliasId)?.exerciseId, a.aliasId).toBe(a.exerciseId);
    }
    // Every occurrence ref is either a canonical exercise id or an alias.
    for (const o of occurrences) {
      const isCanonical = o.sourceRef === o.exerciseId;
      expect(isCanonical || aliasIds.has(o.sourceRef), o.sourceRef).toBe(true);
    }
  });
});
