import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  and,
  asc,
  contentHash,
  count,
  eq,
  exerciseIdFor,
  exerciseOccurrences,
  exerciseSessions,
  exercises,
  ne,
} from '@parle-tcf/db';
import { type TestDb, createTestDb } from '@parle-tcf/db/testing';
import { importSession } from './import';
import type { ParsedSubject } from './parse';

const URL_DEC = 'https://reussir-tcfcanada.com/decembre-2025-expression-orale/';
const URL_JAN = 'https://reussir-tcfcanada.com/janvier-2026-expression-orale/';
const URL_JUN = 'https://reussir-tcfcanada.com/juin-2025-expression-orale/';

const A = 'Je suis votre voisin. Vous me posez des questions sur le quartier.';
const B = 'Je suis libraire. Vous cherchez un roman pour votre neveu.';
const D = "Faut-il interdire les téléphones portables à l'école ? Justifiez.";

const subject = (
  task: 2 | 3,
  part: number,
  position: number,
  text: string,
  extra: Partial<ParsedSubject> = {}
): ParsedSubject => ({
  task,
  part,
  position,
  text,
  html: `<em>${text}</em>`,
  scenario: null,
  instruction: null,
  ...extra,
});

const idOf = (task: number, text: string) => exerciseIdFor(task, contentHash(text));

const NOW_1 = new Date('2026-01-10T08:00:00.000Z');
const NOW_2 = new Date('2026-02-10T09:30:00.000Z');

describe('importSession', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.close());

  const countOf = async (
    table: typeof exercises | typeof exerciseOccurrences | typeof exerciseSessions
  ) => {
    const [row] = await testDb.db.select({ n: count() }).from(table);
    return row.n;
  };

  // Runs first, on the data migrated from the CSV (no truncation yet).
  describe('on the migrated bank', () => {
    it('reuses a migrated CSV exercise with the same task and text', async () => {
      const [existing] = await testDb.db
        .select()
        .from(exercises)
        .where(and(eq(exercises.task, 2), ne(exercises.id, 't1-entretien')))
        .orderBy(asc(exercises.id))
        .limit(1);
      expect(existing).toBeDefined();
      const exercisesBefore = await countOf(exercises);
      const occurrencesBefore = await countOf(exerciseOccurrences);
      const sessionsBefore = await countOf(exerciseSessions);

      // Same subject with typographic apostrophes and extra spaces.
      const text = existing.prompt.replace(/'/g, '’').replace(/ /g, '  ');
      const result = await importSession(
        testDb.db,
        { year: 2026, month: 1, sourceUrl: URL_JAN },
        [subject(2, 1, 1, text, { scenario: 'Scénario importé' })],
        { now: NOW_1 }
      );

      expect(result).toEqual({ inserted: 0, updated: 1, occurrences: 1 });
      expect(await countOf(exercises)).toBe(exercisesBefore);
      expect(await countOf(exerciseOccurrences)).toBe(occurrencesBefore + 1);
      expect(await countOf(exerciseSessions)).toBe(sessionsBefore + 1);

      const [after] = await testDb.db.select().from(exercises).where(eq(exercises.id, existing.id));
      expect(after.prompt).toBe(existing.prompt);
      expect(after.lastSeenOn).toBe('2026-01-01');
      expect(after.firstSeenOn).toBe(existing.firstSeenOn);
      expect(after.scenario).toBe('Scénario importé');

      const [occ] = await testDb.db
        .select()
        .from(exerciseOccurrences)
        .where(eq(exerciseOccurrences.sourceRef, '2026-01-t2-p001-s001'));
      expect(occ.exerciseId).toBe(existing.id);
    });
  });

  describe('on an empty bank', () => {
    beforeEach(async () => {
      await testDb.truncateAll();
    });

    it('creates the session, the exercises and the occurrences', async () => {
      const result = await importSession(
        testDb.db,
        { year: 2025, month: 12, sourceUrl: URL_DEC },
        [
          subject(2, 1, 1, A, {
            html: 'Je suis votre voisin. <span style="color:#00ccff">Vous me posez des questions sur le quartier.</span>',
            scenario: 'Je suis votre voisin.',
            instruction: 'Vous me posez des questions sur le quartier.',
          }),
          subject(2, 1, 2, B),
          subject(2, 2, 1, A),
          subject(3, 1, 1, A),
        ],
        { now: NOW_1 }
      );
      expect(result).toEqual({ inserted: 3, updated: 0, occurrences: 4 });

      const sessions = await testDb.db.select().from(exerciseSessions);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toMatchObject({
        year: 2025,
        month: 12,
        sourceUrl: URL_DEC,
      });
      expect(sessions[0].fetchedAt?.getTime()).toBe(NOW_1.getTime());

      const rows = await testDb.db.select().from(exercises).orderBy(asc(exercises.id));
      expect(rows).toHaveLength(3);
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get(idOf(2, A))).toMatchObject({
        task: 2,
        prompt: A,
        contentHash: contentHash(A),
        contentHtml:
          'Je suis votre voisin. <span style="color:#00ccff">Vous me posez des questions sur le quartier.</span>',
        scenario: 'Je suis votre voisin.',
        instruction: 'Vous me posez des questions sur le quartier.',
        sourceUrl: URL_DEC,
        firstSeenOn: '2025-12-01',
        lastSeenOn: '2025-12-01',
      });
      expect(byId.get(idOf(2, B))).toMatchObject({
        task: 2,
        prompt: B,
        contentHash: contentHash(B),
        contentHtml: `<em>${B}</em>`,
        scenario: null,
        instruction: null,
        sourceUrl: URL_DEC,
        firstSeenOn: '2025-12-01',
        lastSeenOn: '2025-12-01',
      });
      expect(byId.get(idOf(3, A))).toMatchObject({
        task: 3,
        prompt: A,
        contentHash: contentHash(A),
      });

      const occ = await testDb.db
        .select()
        .from(exerciseOccurrences)
        .orderBy(asc(exerciseOccurrences.sourceRef));
      const sessionId = sessions[0].id;
      expect(occ).toEqual([
        {
          sourceRef: '2025-12-t2-p001-s001',
          exerciseId: idOf(2, A),
          sessionId,
          task: 2,
          part: 1,
          position: 1,
        },
        {
          sourceRef: '2025-12-t2-p001-s002',
          exerciseId: idOf(2, B),
          sessionId,
          task: 2,
          part: 1,
          position: 2,
        },
        {
          sourceRef: '2025-12-t2-p002-s001',
          exerciseId: idOf(2, A),
          sessionId,
          task: 2,
          part: 2,
          position: 1,
        },
        {
          sourceRef: '2025-12-t3-p001-s001',
          exerciseId: idOf(3, A),
          sessionId,
          task: 3,
          part: 1,
          position: 1,
        },
      ]);
    });

    it('is idempotent when re-run with the same call', async () => {
      const subjects = [
        subject(2, 1, 1, A),
        subject(2, 1, 2, B),
        subject(2, 2, 1, A),
        subject(3, 1, 1, A),
      ];
      const session = { year: 2025, month: 12, sourceUrl: URL_DEC };
      await importSession(testDb.db, session, subjects, { now: NOW_1 });
      const before = await testDb.db.select().from(exercises).orderBy(asc(exercises.id));

      const again = await importSession(testDb.db, session, subjects, {
        now: NOW_2,
      });
      expect(again).toEqual({ inserted: 0, updated: 3, occurrences: 4 });
      expect(await countOf(exercises)).toBe(3);
      expect(await countOf(exerciseOccurrences)).toBe(4);
      expect(await countOf(exerciseSessions)).toBe(1);
      expect(await testDb.db.select().from(exercises).orderBy(asc(exercises.id))).toEqual(before);

      const [s] = await testDb.db.select().from(exerciseSessions);
      expect(s.fetchedAt?.getTime()).toBe(NOW_2.getTime());
    });

    it('updates the session URL on a later import of the same month', async () => {
      const session = { year: 2025, month: 12, sourceUrl: URL_DEC };
      await importSession(testDb.db, session, [subject(2, 1, 1, A)], {
        now: NOW_1,
      });
      await importSession(
        testDb.db,
        { ...session, sourceUrl: `${URL_DEC}?v=2` },
        [subject(2, 1, 1, A)],
        { now: NOW_2 }
      );
      const sessions = await testDb.db.select().from(exerciseSessions);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sourceUrl).toBe(`${URL_DEC}?v=2`);
    });

    it('counts inserted and updated exercises once each', async () => {
      await importSession(
        testDb.db,
        { year: 2025, month: 12, sourceUrl: URL_DEC },
        [subject(2, 1, 1, A)],
        { now: NOW_1 }
      );
      const result = await importSession(
        testDb.db,
        { year: 2026, month: 1, sourceUrl: URL_JAN },
        [
          subject(2, 1, 1, A),
          subject(2, 1, 2, A),
          subject(3, 1, 1, D),
          subject(3, 1, 2, D),
          subject(3, 2, 1, D),
        ],
        { now: NOW_2 }
      );
      expect(result).toEqual({ inserted: 1, updated: 1, occurrences: 5 });
      expect(await countOf(exercises)).toBe(2);
      expect(await countOf(exerciseOccurrences)).toBe(6);
      expect(await countOf(exerciseSessions)).toBe(2);
    });

    it('widens first/last seen in both directions and keeps prompt and id', async () => {
      await importSession(
        testDb.db,
        { year: 2025, month: 12, sourceUrl: URL_DEC },
        [subject(2, 1, 1, A, { html: '<b>premier</b>' })],
        { now: NOW_1 }
      );
      // Later month: last_seen moves forward, null fields get filled, others kept.
      const later = await importSession(
        testDb.db,
        { year: 2026, month: 1, sourceUrl: URL_JAN },
        [
          subject(2, 3, 4, `  ${A.replace('Vous', 'Vous ')} `, {
            html: '<b>second</b>',
            scenario: 'Scénario B',
            instruction: 'Consigne B',
          }),
        ],
        { now: NOW_2 }
      );
      expect(later).toEqual({ inserted: 0, updated: 1, occurrences: 1 });
      let [row] = await testDb.db.select().from(exercises);
      expect(row).toMatchObject({
        id: idOf(2, A),
        prompt: A,
        contentHtml: '<b>premier</b>',
        scenario: 'Scénario B',
        instruction: 'Consigne B',
        firstSeenOn: '2025-12-01',
        lastSeenOn: '2026-01-01',
      });

      // Earlier month: first_seen moves back, non-null fields stay.
      await importSession(
        testDb.db,
        { year: 2025, month: 6, sourceUrl: URL_JUN },
        [
          subject(2, 1, 1, A, {
            html: '<b>troisième</b>',
            scenario: 'Scénario C',
            instruction: 'Consigne C',
          }),
        ],
        { now: NOW_2 }
      );
      [row] = await testDb.db.select().from(exercises);
      expect(row).toMatchObject({
        id: idOf(2, A),
        prompt: A,
        contentHtml: '<b>premier</b>',
        scenario: 'Scénario B',
        instruction: 'Consigne B',
        firstSeenOn: '2025-06-01',
        lastSeenOn: '2026-01-01',
      });

      // A month in between changes neither bound.
      await importSession(
        testDb.db,
        { year: 2025, month: 9, sourceUrl: URL_DEC },
        [subject(2, 1, 1, A)],
        { now: NOW_2 }
      );
      [row] = await testDb.db.select().from(exercises);
      expect(row).toMatchObject({
        firstSeenOn: '2025-06-01',
        lastSeenOn: '2026-01-01',
      });
      expect(await countOf(exercises)).toBe(1);
      expect(await countOf(exerciseOccurrences)).toBe(4);
      expect(await countOf(exerciseSessions)).toBe(4);
    });

    it('repoints an existing occurrence to the new subject at that position', async () => {
      const session = { year: 2025, month: 12, sourceUrl: URL_DEC };
      await importSession(testDb.db, session, [subject(2, 1, 1, A)], {
        now: NOW_1,
      });
      const result = await importSession(testDb.db, session, [subject(2, 1, 1, B)], { now: NOW_2 });
      expect(result).toEqual({ inserted: 1, updated: 0, occurrences: 1 });
      const occ = await testDb.db.select().from(exerciseOccurrences);
      expect(occ).toHaveLength(1);
      expect(occ[0].sourceRef).toBe('2025-12-t2-p001-s001');
      expect(occ[0].exerciseId).toBe(idOf(2, B));
    });

    it('writes nothing when one subject is invalid (single transaction)', async () => {
      await expect(
        importSession(
          testDb.db,
          { year: 2025, month: 12, sourceUrl: URL_DEC },
          [subject(2, 1, 1, A), subject(2, 1000, 1, B)],
          { now: NOW_1 }
        )
      ).rejects.toThrow();
      expect(await countOf(exercises)).toBe(0);
      expect(await countOf(exerciseOccurrences)).toBe(0);
      expect(await countOf(exerciseSessions)).toBe(0);
    });

    it('returns zero counts for an empty subject list', async () => {
      expect(
        await importSession(testDb.db, { year: 2025, month: 12, sourceUrl: URL_DEC }, [], {
          now: NOW_1,
        })
      ).toEqual({ inserted: 0, updated: 0, occurrences: 0 });
      expect(await countOf(exercises)).toBe(0);
      expect(await countOf(exerciseOccurrences)).toBe(0);
    });

    it('defaults now to the current time', async () => {
      const before = Date.now();
      await importSession(testDb.db, { year: 2025, month: 12, sourceUrl: URL_DEC }, [
        subject(2, 1, 1, A),
      ]);
      const after = Date.now();
      const [s] = await testDb.db.select().from(exerciseSessions);
      const t = s.fetchedAt!.getTime();
      expect(t).toBeGreaterThanOrEqual(before - 1);
      expect(t).toBeLessThanOrEqual(after + 1);
    });
  });
});
