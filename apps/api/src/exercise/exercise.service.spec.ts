import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  SAMPLE_EXERCISE_BANK_PATH,
  contentHash,
  eq,
  exerciseAliases,
  exerciseOccurrences,
  exerciseSessions,
  exercises,
  inArray,
  loadExerciseBank,
} from '@parle-tcf/db';
import { type TestDb, createTestDb } from '@parle-tcf/db/testing';
import { ExerciseService } from './exercise.service.js';

interface ExerciseFixture {
  id: string;
  task: number;
  prompt: string;
  firstSeenOn?: string | null;
  lastSeenOn?: string | null;
  isImageBased?: boolean;
  imageUrl?: string | null;
  scenario?: string | null;
  instruction?: string | null;
}

describe('ExerciseService', () => {
  let testDb: TestDb;
  let service: ExerciseService;

  beforeAll(async () => {
    testDb = await createTestDb();
    // The migrations ship no subjects: start from the sample bank, like a fresh install.
    await loadExerciseBank(testDb.db, readFileSync(SAMPLE_EXERCISE_BANK_PATH, 'utf8'));
    service = new ExerciseService(testDb.db);
  });
  afterAll(() => testDb.close());

  const insertExercises = (rows: ExerciseFixture[]) =>
    testDb.db.insert(exercises).values(
      rows.map((r) => ({
        firstSeenOn: null,
        lastSeenOn: null,
        ...r,
        contentHash: contentHash(r.prompt),
      }))
    );

  const insertSession = async (year: number, month: number) => {
    const [row] = await testDb.db
      .insert(exerciseSessions)
      .values({
        year,
        month,
        sourceUrl: `https://example.test/${year}-${month}`,
      })
      .returning();
    return row.id;
  };

  let refSeq = 0;
  const insertOccurrence = (exerciseId: string, sessionId: number, task: number) => {
    refSeq += 1;
    return testDb.db.insert(exerciseOccurrences).values({
      sourceRef: `2000-01-t${task}-p001-s${String(refSeq).padStart(3, '0')}`,
      exerciseId,
      sessionId,
      task,
      part: 1,
      position: refSeq,
    });
  };

  // Runs first, on the loaded sample bank (2026-09 and 2026-10).
  describe('on the sample bank', () => {
    it('lists the 2 sample sessions, newest first, and every subject exercise', async () => {
      const sessions = await service.listSessions();
      expect(sessions.map((s) => [s.year, s.month])).toEqual([
        [2026, 10],
        [2026, 9],
      ]);
      const t2 = await service.listExercises({ task: 2, limit: 1 });
      const t3 = await service.listExercises({ task: 3, limit: 1 });
      expect(t2.items).toHaveLength(1);
      expect(t2.total).toBeGreaterThanOrEqual(21);
      expect(t3.total).toBeGreaterThanOrEqual(5);
      const subjects = await testDb.db
        .select({ id: exercises.id })
        .from(exercises)
        .where(inArray(exercises.task, [2, 3]));
      expect(t2.total + t3.total).toBe(subjects.length);
      for (let i = 1; i < sessions.length; i++) {
        const prev = sessions[i - 1];
        const cur = sessions[i];
        expect(prev.year * 12 + prev.month).toBeGreaterThan(cur.year * 12 + cur.month);
      }
    });

    it('features the latest sample session with 3 subjects per task', async () => {
      const [latest] = await service.listSessions();
      const out = await service.featured();
      expect(out.session).toEqual(latest);
      expect([out.session?.year, out.session?.month]).toEqual([2026, 10]);
      const t2 = await service.listExercises({
        task: 2,
        sessionId: latest.id,
      });
      const t3 = await service.listExercises({
        task: 3,
        sessionId: latest.id,
      });
      expect(out.items).toEqual([...t2.items.slice(0, 3), ...t3.items.slice(0, 3)]);
      // Each sample session has more than 3 subjects of each task.
      expect(out.items).toHaveLength(6);
    });

    it('finds a sample subject by its id', async () => {
      const [first] = await testDb.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, '2026-10-t2-p001-s001'));
      expect(first).toBeDefined();
      const row = await service.getExerciseById(first.id);
      expect(row).toMatchObject({ id: first.id, content: first.prompt });
    });
  });

  describe('with fixture rows', () => {
    beforeEach(async () => {
      await testDb.truncateAll();
      refSeq = 0;
    });

    describe('getExerciseById', () => {
      it('returns an exercise by its own id', async () => {
        await insertExercises([{ id: 'canon', task: 2, prompt: 'Je suis votre voisin.' }]);
        const row = await service.getExerciseById('canon');
        expect(row).toMatchObject({
          id: 'canon',
          content: 'Je suis votre voisin.',
          isImageBased: false,
        });
      });

      it("resolves an alias id to the target exercise, with the target's id", async () => {
        await insertExercises([{ id: 'canon', task: 2, prompt: 'Je suis votre voisin.' }]);
        await testDb.db.insert(exerciseAliases).values({ aliasId: 'old-id', exerciseId: 'canon' });
        const row = await service.getExerciseById('old-id');
        expect(row).toMatchObject({
          id: 'canon',
          content: 'Je suis votre voisin.',
        });
      });

      it('returns nothing for an unknown id', async () => {
        expect((await service.getExerciseById('nope')) ?? null).toBeNull();
      });

      it('includes scenario and instruction only when set', async () => {
        await insertExercises([
          {
            id: 'with',
            task: 2,
            prompt: 'Je suis guide. Vous me demandez le programme.',
            scenario: 'Je suis guide.',
            instruction: 'Vous me demandez le programme.',
          },
          { id: 'without', task: 2, prompt: 'Je suis serveur.' },
        ]);
        const withRow = await service.getExerciseById('with');
        expect(withRow!.scenario).toBe('Je suis guide.');
        expect(withRow!.instruction).toBe('Vous me demandez le programme.');
        const withoutRow = await service.getExerciseById('without');
        expect(withoutRow!.scenario).toBeUndefined();
        expect(withoutRow!.instruction).toBeUndefined();
      });

      it('keeps the image fields', async () => {
        await insertExercises([
          {
            id: 'img',
            task: 3,
            prompt: 'Décrivez cette image.',
            isImageBased: true,
            imageUrl: 'https://img.test/a.png',
          },
          { id: 'plain', task: 3, prompt: 'Un sujet sans image.' },
        ]);
        expect(await service.getExerciseById('img')).toMatchObject({
          imageUrl: 'https://img.test/a.png',
          isImageBased: true,
        });
        const plain = await service.getExerciseById('plain');
        expect(plain!.isImageBased).toBe(false);
        expect(plain!.imageUrl ?? undefined).toBeUndefined();
      });
    });

    describe('source and image links', () => {
      it('exposes url and imageUrl only when set', async () => {
        await insertExercises([
          { id: 'plain', task: 3, prompt: 'Un sujet sans lien.' },
          { id: 'linked', task: 3, prompt: 'Un sujet avec lien.' },
        ]);
        await testDb.db
          .update(exercises)
          .set({ sourceUrl: 'https://source.test/s1' })
          .where(eq(exercises.id, 'linked'));
        expect(await service.getExerciseById('linked')).toMatchObject({
          url: 'https://source.test/s1',
        });
        const plain = await service.getExerciseById('plain');
        expect(plain).not.toHaveProperty('url');
        expect(plain).not.toHaveProperty('imageUrl');
      });
    });

    describe('getRandomTcfExercise', () => {
      it("picks a subject of the task's bank", async () => {
        await insertExercises([
          { id: 't2', task: 2, prompt: 'Jeu de rôle.' },
          { id: 't3', task: 3, prompt: 'Débat.' },
        ]);
        expect(await service.getRandomTcfExercise('tache2')).toEqual({
          id: 't2',
          task: 2,
          content: 'Jeu de rôle.',
          isImageBased: false,
        });
        expect((await service.getRandomTcfExercise('tache3'))?.id).toBe('t3');
      });

      it('returns null on an empty bank', async () => {
        expect(await service.getRandomTcfExercise('tache2')).toBeNull();
      });
    });

    describe('resolveExerciseForTask', () => {
      it('accepts an alias of an exercise of the requested task', async () => {
        await insertExercises([{ id: 'canon', task: 2, prompt: 'Je suis votre voisin.' }]);
        await testDb.db.insert(exerciseAliases).values({ aliasId: 'old-id', exerciseId: 'canon' });
        const row = await service.resolveExerciseForTask('tache2', 'old-id');
        expect(row?.id).toBe('canon');
        expect((await service.resolveExerciseForTask('tache3', 'old-id')) ?? null).toBeNull();
      });

      it('always serves the fixed interview row for tâche 1', async () => {
        await insertExercises([
          { id: 't1-entretien', task: 1, prompt: 'Entretien dirigé.' },
          { id: 't1-other', task: 1, prompt: 'Autre entretien.' },
        ]);
        expect((await service.resolveExerciseForTask('tache1', 't1-other'))?.id).toBe(
          't1-entretien'
        );
        expect((await service.resolveExerciseForTask('tache1'))?.id).toBe('t1-entretien');
      });

      it('draws a random subject of the task when no id is given', async () => {
        await insertExercises([{ id: 'only-t2', task: 2, prompt: 'Seul sujet.' }]);
        expect((await service.resolveExerciseForTask('tache2'))?.id).toBe('only-t2');
      });
    });

    describe('listSessions', () => {
      it('lists sessions with occurrences, newest first, with distinct exercise counts per task', async () => {
        await insertExercises([
          { id: 'e2a', task: 2, prompt: 'Sujet deux A' },
          { id: 'e2b', task: 2, prompt: 'Sujet deux B' },
          { id: 'e3a', task: 3, prompt: 'Sujet trois A' },
        ]);
        // Inserted out of date order so that ids do not follow dates.
        const dec25 = await insertSession(2025, 12);
        const empty = await insertSession(2026, 1);
        const nov25 = await insertSession(2025, 11);
        const dec24 = await insertSession(2024, 12);
        expect(empty).toBeGreaterThan(0);

        await insertOccurrence('e2a', dec25, 2);
        await insertOccurrence('e2a', dec25, 2);
        await insertOccurrence('e2b', dec25, 2);
        await insertOccurrence('e3a', dec25, 3);
        await insertOccurrence('e3a', nov25, 3);
        await insertOccurrence('e3a', nov25, 3);
        await insertOccurrence('e2a', dec24, 2);

        expect(await service.listSessions()).toEqual([
          { id: dec25, year: 2025, month: 12, tache2: 2, tache3: 1 },
          { id: nov25, year: 2025, month: 11, tache2: 0, tache3: 1 },
          { id: dec24, year: 2024, month: 12, tache2: 1, tache3: 0 },
        ]);
      });

      it('returns an empty list without occurrences', async () => {
        await insertSession(2025, 12);
        expect(await service.listSessions()).toEqual([]);
      });
    });

    describe('listExercises', () => {
      let s1: number;
      let s2: number;

      beforeEach(async () => {
        await insertExercises([
          {
            id: 'b-2',
            task: 2,
            prompt: 'Vous cherchez un appartement à Montréal.',
            firstSeenOn: '2025-01-01',
            lastSeenOn: '2025-12-01',
          },
          {
            id: 'a-2',
            task: 2,
            prompt: "Je suis votre VOISIN, vous m'interrogez sur l'ÉCOLE.",
            firstSeenOn: '2025-12-01',
            lastSeenOn: '2025-12-01',
          },
          {
            id: 'c-2',
            task: 2,
            prompt: "Vous organisez une fête d'école.",
            firstSeenOn: '2025-03-01',
            lastSeenOn: '2025-06-01',
          },
          {
            id: 'z-2',
            task: 2,
            prompt: 'Décrivez la photo du marché.',
            firstSeenOn: '2024-01-01',
            lastSeenOn: '2024-01-01',
            isImageBased: true,
            imageUrl: 'https://img.test/m.png',
          },
          {
            id: 'a-3',
            task: 3,
            prompt: 'École à la maison : êtes-vous pour ?',
            firstSeenOn: '2026-01-01',
            lastSeenOn: '2026-01-01',
          },
        ]);
        s1 = await insertSession(2025, 11);
        s2 = await insertSession(2025, 12);
        await insertOccurrence('b-2', s2, 2);
        await insertOccurrence('b-2', s2, 2);
        await insertOccurrence('b-2', s1, 2);
        await insertOccurrence('a-2', s2, 2);
        await insertOccurrence('c-2', s1, 2);
        await insertOccurrence('a-3', s2, 3);
      });

      it('lists one task, ordered by last seen desc then id asc, with publication counts', async () => {
        expect(await service.listExercises({ task: 2 })).toEqual({
          items: [
            {
              id: 'a-2',
              task: 2,
              prompt: "Je suis votre VOISIN, vous m'interrogez sur l'ÉCOLE.",
              firstSeenOn: '2025-12-01',
              lastSeenOn: '2025-12-01',
              timesPublished: 1,
              isImageBased: false,
            },
            {
              id: 'b-2',
              task: 2,
              prompt: 'Vous cherchez un appartement à Montréal.',
              firstSeenOn: '2025-01-01',
              lastSeenOn: '2025-12-01',
              timesPublished: 3,
              isImageBased: false,
            },
            {
              id: 'c-2',
              task: 2,
              prompt: "Vous organisez une fête d'école.",
              firstSeenOn: '2025-03-01',
              lastSeenOn: '2025-06-01',
              timesPublished: 1,
              isImageBased: false,
            },
            {
              id: 'z-2',
              task: 2,
              prompt: 'Décrivez la photo du marché.',
              firstSeenOn: '2024-01-01',
              lastSeenOn: '2024-01-01',
              timesPublished: 0,
              isImageBased: true,
            },
          ],
          total: 4,
        });
      });

      it('lists task 3 separately', async () => {
        const out = await service.listExercises({ task: 3 });
        expect(out.total).toBe(1);
        expect(out.items.map((i) => [i.id, i.task, i.timesPublished])).toEqual([['a-3', 3, 1]]);
      });

      it('filters by session without duplicating exercises', async () => {
        const inS2 = await service.listExercises({ task: 2, sessionId: s2 });
        expect(inS2.items.map((i) => i.id)).toEqual(['a-2', 'b-2']);
        expect(inS2.total).toBe(2);
        // timesPublished counts every occurrence of the exercise.
        expect(inS2.items[1].timesPublished).toBe(3);

        const inS1 = await service.listExercises({ task: 2, sessionId: s1 });
        expect(inS1.items.map((i) => i.id)).toEqual(['b-2', 'c-2']);
        expect(inS1.total).toBe(2);

        const t3InS1 = await service.listExercises({ task: 3, sessionId: s1 });
        expect(t3InS1).toEqual({ items: [], total: 0 });
      });

      it.each([
        ['ecole', ['a-2', 'c-2']],
        ['ÉCOLE', ['a-2', 'c-2']],
        ['Ecole', ['a-2', 'c-2']],
        ['montreal', ['b-2']],
        ['MONTRÉAL', ['b-2']],
        ['  voisin  ', ['a-2']],
        ["fête d'école", ['c-2']],
        ['introuvable', []],
      ])('searches %j case- and accent-insensitively', async (search, ids) => {
        const out = await service.listExercises({ task: 2, search });
        expect(out.items.map((i) => i.id)).toEqual(ids);
        expect(out.total).toBe(ids.length);
      });

      it('matches % and _ literally in a search', async () => {
        await insertExercises([
          { id: 'pct', task: 2, prompt: 'Une remise de 100% ce soir.' },
          { id: 'pct-like', task: 2, prompt: 'Une remise de 1000 euros.' },
          { id: 'und', task: 2, prompt: 'Le code a_b est valide.' },
          { id: 'und-like', task: 2, prompt: 'Le code axb est valide.' },
        ]);
        expect(
          (await service.listExercises({ task: 2, search: '100%' })).items.map((i) => i.id)
        ).toEqual(['pct']);
        expect(
          (await service.listExercises({ task: 2, search: 'a_b' })).items.map((i) => i.id)
        ).toEqual(['und']);
      });

      it('ignores a blank search', async () => {
        for (const search of ['', '   ', '\t']) {
          const out = await service.listExercises({ task: 2, search });
          expect(out.total).toBe(4);
        }
      });

      it('does not return other tasks when searching', async () => {
        const out = await service.listExercises({ task: 3, search: 'ecole' });
        expect(out.items.map((i) => i.id)).toEqual(['a-3']);
      });

      it('combines session and search filters', async () => {
        const out = await service.listExercises({
          task: 2,
          sessionId: s1,
          search: 'ECOLE',
        });
        expect(out.items.map((i) => i.id)).toEqual(['c-2']);
        expect(out.total).toBe(1);
      });

      it('paginates with total counted before pagination', async () => {
        const p1 = await service.listExercises({ task: 2, limit: 2 });
        expect(p1.items.map((i) => i.id)).toEqual(['a-2', 'b-2']);
        expect(p1.total).toBe(4);
        const p2 = await service.listExercises({
          task: 2,
          limit: 2,
          offset: 2,
        });
        expect(p2.items.map((i) => i.id)).toEqual(['c-2', 'z-2']);
        expect(p2.total).toBe(4);
        const p3 = await service.listExercises({
          task: 2,
          limit: 2,
          offset: 3,
        });
        expect(p3.items.map((i) => i.id)).toEqual(['z-2']);
        const past = await service.listExercises({ task: 2, offset: 4 });
        expect(past).toEqual({ items: [], total: 4 });
      });

      it('treats a negative offset as 0', async () => {
        const out = await service.listExercises({ task: 2, offset: -3 });
        expect(out.items.map((i) => i.id)).toEqual(['a-2', 'b-2', 'c-2', 'z-2']);
      });

      it.each([
        [0, 1],
        [-5, 1],
        [1, 1],
        [3, 3],
      ])('clamps limit %i to %i items', async (limit, expected) => {
        const out = await service.listExercises({ task: 2, limit });
        expect(out.items).toHaveLength(expected);
        expect(out.items[0].id).toBe('a-2');
        expect(out.total).toBe(4);
      });
    });

    describe('featured', () => {
      it('returns no session and no items on an empty bank', async () => {
        expect(await service.featured()).toEqual({ session: null, items: [] });
      });

      it('returns no session when no session has occurrences', async () => {
        await insertExercises([
          { id: 'e2', task: 2, prompt: 'Sujet sans publication.' },
          { id: 'e3', task: 3, prompt: 'Autre sujet sans publication.' },
        ]);
        await insertSession(2026, 1);
        expect(await service.featured()).toEqual({ session: null, items: [] });
        expect(await service.featured(5)).toEqual({ session: null, items: [] });
      });

      describe('with several sessions', () => {
        let older: number;
        let latest: number;
        let emptyNewer: number;

        beforeEach(async () => {
          // Ids do not follow the alphabetical order of lastSeenOn, and tâche 3
          // subjects are the most recent, so a single global ordering would
          // put them first.
          await insertExercises([
            {
              id: 't2-d',
              task: 2,
              prompt: 'Sujet T2 D',
              lastSeenOn: '2025-12-01',
            },
            {
              id: 't2-a',
              task: 2,
              prompt: 'Sujet T2 A',
              lastSeenOn: '2025-10-01',
            },
            {
              id: 't2-c',
              task: 2,
              prompt: 'Sujet T2 C',
              lastSeenOn: '2025-12-01',
            },
            {
              id: 't2-b',
              task: 2,
              prompt: 'Sujet T2 B',
              lastSeenOn: '2025-11-01',
            },
            {
              id: 't2-old',
              task: 2,
              prompt: 'Sujet T2 ancien',
              lastSeenOn: '2026-02-01',
            },
            {
              id: 't3-z',
              task: 3,
              prompt: 'Sujet T3 Z',
              lastSeenOn: '2026-01-01',
            },
            {
              id: 't3-y',
              task: 3,
              prompt: 'Sujet T3 Y',
              lastSeenOn: '2026-01-01',
            },
            {
              id: 't3-x',
              task: 3,
              prompt: 'Sujet T3 X',
              lastSeenOn: '2025-12-15',
            },
            {
              id: 't3-w',
              task: 3,
              prompt: 'Sujet T3 W',
              lastSeenOn: '2025-12-20',
            },
            {
              id: 't3-old',
              task: 3,
              prompt: 'Sujet T3 ancien',
              lastSeenOn: '2026-03-01',
            },
          ]);
          // Inserted out of date order so that ids do not follow dates.
          latest = await insertSession(2025, 12);
          older = await insertSession(2025, 11);
          // Newer but without occurrences: not a "session" for listSessions.
          emptyNewer = await insertSession(2026, 2);
          expect(emptyNewer).toBeGreaterThan(latest);

          for (const id of ['t2-a', 't2-b', 't2-c', 't2-d']) {
            await insertOccurrence(id, latest, 2);
          }
          // Published twice in the same month: still one subject.
          await insertOccurrence('t2-c', latest, 2);
          for (const id of ['t3-w', 't3-x', 't3-y', 't3-z']) {
            await insertOccurrence(id, latest, 3);
          }
          await insertOccurrence('t2-old', older, 2);
          await insertOccurrence('t3-old', older, 3);
          await insertOccurrence('t2-a', older, 2);
        });

        it('uses the most recent session, as listSessions()[0]', async () => {
          const out = await service.featured();
          const [first] = await service.listSessions();
          expect(out.session).toEqual(first);
          expect(out.session).toMatchObject({
            id: latest,
            year: 2025,
            month: 12,
          });
        });

        it('caps each task at 3 by default, tâche 2 first, in listExercises order', async () => {
          const out = await service.featured();
          const t2 = await service.listExercises({
            task: 2,
            sessionId: latest,
          });
          const t3 = await service.listExercises({
            task: 3,
            sessionId: latest,
          });
          expect(out.items).toEqual([...t2.items.slice(0, 3), ...t3.items.slice(0, 3)]);
          expect(out.items.map((i) => i.id)).toEqual([
            't2-c',
            't2-d',
            't2-b',
            't3-y',
            't3-z',
            't3-w',
          ]);
          expect(out.items.map((i) => i.task)).toEqual([2, 2, 2, 3, 3, 3]);
        });

        it('keeps the list item fields, publication counts included', async () => {
          const out = await service.featured();
          expect(out.items[0]).toEqual({
            id: 't2-c',
            task: 2,
            prompt: 'Sujet T2 C',
            firstSeenOn: null,
            lastSeenOn: '2025-12-01',
            timesPublished: 2,
            isImageBased: false,
          });
        });

        it('never includes subjects only published in an older session', async () => {
          const out = await service.featured(10);
          const ids = out.items.map((i) => i.id);
          expect(ids).not.toContain('t2-old');
          expect(ids).not.toContain('t3-old');
        });

        it.each([
          [1, ['t2-c', 't3-y']],
          [2, ['t2-c', 't2-d', 't3-y', 't3-z']],
          [4, ['t2-c', 't2-d', 't2-b', 't2-a', 't3-y', 't3-z', 't3-w', 't3-x']],
          [5, ['t2-c', 't2-d', 't2-b', 't2-a', 't3-y', 't3-z', 't3-w', 't3-x']],
        ])('caps each task at perTask = %i', async (perTask, ids) => {
          const out = await service.featured(perTask);
          expect(out.items.map((i) => i.id)).toEqual(ids);
          expect(out.session?.id).toBe(latest);
        });
      });

      it('returns only the tasks the latest session has', async () => {
        await insertExercises([
          {
            id: 'only-3',
            task: 3,
            prompt: 'Seul sujet T3',
            lastSeenOn: '2026-01-01',
          },
          {
            id: 'prev-2',
            task: 2,
            prompt: 'Ancien sujet T2',
            lastSeenOn: '2025-12-01',
          },
        ]);
        const prev = await insertSession(2025, 12);
        const cur = await insertSession(2026, 1);
        await insertOccurrence('prev-2', prev, 2);
        await insertOccurrence('only-3', cur, 3);
        const out = await service.featured();
        expect(out.session).toMatchObject({ id: cur, tache2: 0, tache3: 1 });
        expect(out.items.map((i) => i.id)).toEqual(['only-3']);
      });
    });

    describe('listExercises limits on a large bank', () => {
      beforeEach(async () => {
        const rows: ExerciseFixture[] = [];
        for (let i = 0; i < 105; i++) {
          rows.push({
            id: `x-${String(i).padStart(3, '0')}`,
            task: 2,
            prompt: `Sujet généré numéro ${i}.`,
            firstSeenOn: '2025-01-01',
            lastSeenOn: '2025-01-01',
          });
        }
        await insertExercises(rows);
      });

      it.each([
        [undefined, 20],
        [99, 99],
        [100, 100],
        [101, 100],
        [1000, 100],
      ])('returns %s -> %i items', async (limit, expected) => {
        const out = await service.listExercises(
          limit === undefined ? { task: 2 } : { task: 2, limit }
        );
        expect(out.items).toHaveLength(expected);
        expect(out.total).toBe(105);
        expect(out.items[0].id).toBe('x-000');
        expect(out.items[expected - 1].id).toBe(`x-${String(expected - 1).padStart(3, '0')}`);
      });

      it('defaults offset to 0 and pages through the end', async () => {
        const last = await service.listExercises({
          task: 2,
          limit: 100,
          offset: 100,
        });
        expect(last.items.map((i) => i.id)).toEqual(['x-100', 'x-101', 'x-102', 'x-103', 'x-104']);
        expect(last.total).toBe(105);
      });
    });
  });
});
