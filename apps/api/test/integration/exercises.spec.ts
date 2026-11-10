import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, exerciseOccurrences, inArray } from '@parle-tcf/db';
import type {
  ExerciseListItem,
  ExerciseSession,
  FeaturedExercises,
  ListExercisesOutput,
} from '@parle-tcf/shared';
import { type TestApp, createTestApp } from './create-test-app.js';
import { expectError, ok, rpc, signUpVerifiedUser } from './helpers.js';

describe('exercises (bank from the real migrations)', () => {
  let t: TestApp;
  let token: string;
  let sessions: ExerciseSession[];

  beforeAll(async () => {
    t = await createTestApp();
    ({ token } = await signUpVerifiedUser(t, 'exercises'));
    sessions = ok<{ sessions: ExerciseSession[] }>(
      await rpc(t, '/exercises/sessions', token)
    ).sessions;
  });
  afterAll(() => t?.close());

  const list = async (input: Record<string, unknown>) =>
    ok<ListExercisesOutput>(await rpc(t, '/exercises/list', token, input));

  const occurrencesIn = async (sessionId: number, ids: string[]) =>
    t.db
      .select({ exerciseId: exerciseOccurrences.exerciseId })
      .from(exerciseOccurrences)
      .where(
        and(
          eq(exerciseOccurrences.sessionId, sessionId),
          inArray(exerciseOccurrences.exerciseId, ids)
        )
      );

  describe('exercises.sessions', () => {
    it('lists the months newest first with their subject counts', () => {
      expect(sessions.length).toBeGreaterThan(0);
      const keys = sessions.map((s) => s.year * 100 + s.month);
      expect([...keys].sort((a, b) => b - a)).toEqual(keys);
      for (const s of sessions) expect(s.tache2 + s.tache3).toBeGreaterThan(0);
    });
  });

  describe('exercises.list', () => {
    it('lists one task with the default page of 20 and a total', async () => {
      const page = await list({ task: 2 });
      expect(page.items.length).toBe(Math.min(20, page.total));
      expect(page.items.every((i) => i.task === 2)).toBe(true);
      const t3 = await list({ task: 3 });
      expect(t3.items.every((i) => i.task === 3)).toBe(true);
    });

    it('filters by month: every subject was published that month, counts match', async () => {
      const month = sessions[0];
      const page = await list({ task: 2, sessionId: month.id, limit: 100 });
      expect(page.total).toBe(month.tache2);
      const ids = page.items.map((i) => i.id);
      const found = new Set((await occurrencesIn(month.id, ids)).map((o) => o.exerciseId));
      expect(found.size).toBe(ids.length);
    });

    it('searches case- and accent-insensitively', async () => {
      const accented = await list({ task: 3, search: 'ÉCOLE' });
      const plain = await list({ task: 3, search: 'ecole' });
      expect(accented.total).toBeGreaterThan(0);
      expect(plain.total).toBe(accented.total);
      expect(plain.items.map((i) => i.id)).toEqual(accented.items.map((i) => i.id));
    });

    it('treats LIKE wildcards in the search literally', async () => {
      expect((await list({ task: 2, search: '%' })).total).toBe(0);
      expect((await list({ task: 2, search: '____' })).total).toBe(0);
    });

    it('returns an empty page for a search without match', async () => {
      expect(await list({ task: 2, search: 'zzzz-aucun-sujet-zzzz' })).toEqual({
        items: [],
        total: 0,
      });
    });

    it('paginates without overlap', async () => {
      const first = await list({ task: 2, limit: 5, offset: 0 });
      const second = await list({ task: 2, limit: 5, offset: 5 });
      expect(second.total).toBe(first.total);
      const overlap = first.items.filter((i) => second.items.some((j) => j.id === i.id));
      expect(overlap).toEqual([]);
    });

    it.each([
      ['task 1', { task: 1 }],
      ['a page over 100', { task: 2, limit: 101 }],
      ['a negative offset', { task: 2, offset: -1 }],
      ['a search over 100 characters', { task: 2, search: 'a'.repeat(101) }],
    ])('rejects %s', async (_label, input) => {
      expectError(await rpc(t, '/exercises/list', token, input), 400, 'BAD_REQUEST');
    });
  });

  describe('exercises.featured (public)', () => {
    it('serves the latest month and up to 3 subjects per task, without a session', async () => {
      const featured = ok<FeaturedExercises>(await rpc(t, '/exercises/featured', null));
      expect(featured.session).toEqual(sessions[0]);

      const byTask = (task: number) =>
        featured.items.filter((i: ExerciseListItem) => i.task === task);
      expect(byTask(2).length).toBe(Math.min(3, sessions[0].tache2));
      expect(byTask(3).length).toBe(Math.min(3, sessions[0].tache3));
      // Tâche 2 first, then tâche 3.
      const tasks = featured.items.map((i) => i.task);
      expect([...tasks].sort()).toEqual(tasks);

      const ids = featured.items.map((i) => i.id);
      expect((await occurrencesIn(sessions[0].id, ids)).length).toBeGreaterThanOrEqual(ids.length);
    });

    it('ignores a bearer token (same answer)', async () => {
      const anonymous = ok(await rpc(t, '/exercises/featured', null));
      const signedIn = ok(await rpc(t, '/exercises/featured', token));
      expect(signedIn).toEqual(anonymous);
    });
  });
});
