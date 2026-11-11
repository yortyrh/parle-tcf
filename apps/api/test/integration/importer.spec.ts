import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  and,
  contentHash,
  eq,
  exerciseIdFor,
  exerciseOccurrences,
  exerciseSessions,
  exercises,
  inArray,
} from '@parle-tcf/db';
import type { ListExercisesOutput } from '@parle-tcf/shared';
// apps/api does not depend on @parle-tcf/importer: import its source directly.
import { importSession } from '../../../../packages/importer/src/import.js';
import { type TestApp, createTestApp } from './create-test-app.js';
import { ok, rpc, signUpVerifiedUser } from './helpers.js';

/** A month far in the future so it never collides with the sample bank. */
const YEAR = 2099;
const URL_NOV = 'https://reussir-tcfcanada.com/novembre-2099-expression-orale/';
const URL_DEC = 'https://reussir-tcfcanada.com/decembre-2099-expression-orale/';

const T2 = 'Intégration : je suis votre nouveau voisin et je cherche une salle de sport.';
const T3 = 'Intégration : faut-il rendre les transports publics gratuits dans les villes ?';

const subject = (task: 2 | 3, position: number, text: string) => ({
  task,
  part: 1,
  position,
  text,
  html: `<strong>${text}</strong>`,
  scenario: null,
  instruction: null,
});

describe('importer upsert against the real Postgres', () => {
  let t: TestApp;
  const ids = [exerciseIdFor(2, contentHash(T2)), exerciseIdFor(3, contentHash(T3))];

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    // Leave the shared database as the global setup made it (migrations + sample bank).
    await t.db.delete(exerciseOccurrences).where(inArray(exerciseOccurrences.exerciseId, ids));
    await t.db.delete(exercises).where(inArray(exercises.id, ids));
    await t.db.delete(exerciseSessions).where(eq(exerciseSessions.year, YEAR));
    await t?.close();
  });

  it('inserts a month, then matches the same subjects when republished', async () => {
    const first = await importSession(t.db, { year: YEAR, month: 11, sourceUrl: URL_NOV }, [
      subject(2, 1, T2),
      subject(3, 1, T3),
    ]);
    expect(first).toEqual({ inserted: 2, updated: 0, occurrences: 2 });

    // Same month again: idempotent.
    const replay = await importSession(t.db, { year: YEAR, month: 11, sourceUrl: URL_NOV }, [
      subject(2, 1, T2),
      subject(3, 1, T3),
    ]);
    expect(replay).toEqual({ inserted: 0, updated: 2, occurrences: 2 });

    // Next month republishes the tâche 2 subject (whitespace differs, same hash).
    const december = await importSession(t.db, { year: YEAR, month: 12, sourceUrl: URL_DEC }, [
      subject(2, 3, `  ${T2.replace(' ', '  ')} `),
    ]);
    expect(december).toEqual({ inserted: 0, updated: 1, occurrences: 1 });

    const rows = await t.db.select().from(exercises).where(inArray(exercises.id, ids));
    expect(rows).toHaveLength(2);
    const t2 = rows.find((r) => r.task === 2);
    expect(t2).toMatchObject({ firstSeenOn: '2099-11-01', lastSeenOn: '2099-12-01' });
    const t3 = rows.find((r) => r.task === 3);
    expect(t3).toMatchObject({ firstSeenOn: '2099-11-01', lastSeenOn: '2099-11-01' });

    const sessions = await t.db
      .select()
      .from(exerciseSessions)
      .where(eq(exerciseSessions.year, YEAR));
    expect(sessions.map((s) => s.month).sort()).toEqual([11, 12]);
    const occurrences = await t.db
      .select()
      .from(exerciseOccurrences)
      .where(and(eq(exerciseOccurrences.exerciseId, ids[0])));
    expect(occurrences).toHaveLength(2);
  });

  it('serves the imported month through the API', async () => {
    const { token } = await signUpVerifiedUser(t, 'importer');
    const [december] = await t.db
      .select()
      .from(exerciseSessions)
      .where(and(eq(exerciseSessions.year, YEAR), eq(exerciseSessions.month, 12)));

    const { sessions } = ok<{ sessions: { id: number; tache2: number; tache3: number }[] }>(
      await rpc(t, '/exercises/sessions', token)
    );
    expect(sessions[0]).toMatchObject({ id: december.id, tache2: 1, tache3: 0 });

    const listed = ok<ListExercisesOutput>(
      await rpc(t, '/exercises/list', token, { task: 2, sessionId: december.id })
    );
    expect(listed.items.map((i) => i.id)).toEqual([ids[0]]);
    expect(listed.items[0].timesPublished).toBe(2);
  });
});
