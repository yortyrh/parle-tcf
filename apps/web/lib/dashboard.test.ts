import { describe, expect, it } from 'vitest';
import type { AttemptSummary, CefrLevel } from '@parle-tcf/shared';
import { recommendNextTask } from './dashboard';

type Attempt = Pick<AttemptSummary, 'task' | 'globalLevel' | 'startedAt' | 'status'>;

const at = (day: number) => `2026-01-${String(day).padStart(2, '0')}T10:00:00.000Z`;

const done = (task: number, day: number, level: CefrLevel | null = null): Attempt => ({
  task,
  startedAt: at(day),
  globalLevel: level,
  status: 'completed',
});

const deepFreeze = (attempts: Attempt[]) =>
  Object.freeze(attempts.map((a) => Object.freeze({ ...a })));

describe('recommendNextTask', () => {
  describe('never-tried', () => {
    it('recommends tâche 1 without any attempt', () => {
      expect(recommendNextTask([])).toEqual({ task: 1, reason: 'never-tried' });
    });

    it('recommends the lowest-numbered task without a completed attempt', () => {
      expect(recommendNextTask([done(1, 1, 'B1')])).toEqual({ task: 2, reason: 'never-tried' });
      expect(recommendNextTask([done(1, 1), done(3, 2)])).toEqual({
        task: 2,
        reason: 'never-tried',
      });
      expect(recommendNextTask([done(3, 1), done(2, 2)])).toEqual({
        task: 1,
        reason: 'never-tried',
      });
      expect(recommendNextTask([done(1, 1), done(2, 2)])).toEqual({
        task: 3,
        reason: 'never-tried',
      });
    });

    it.each(['in_progress', 'interrupted'] as const)('does not count %s attempts', (status) => {
      const attempts: Attempt[] = [
        { task: 1, startedAt: at(5), globalLevel: 'C2', status },
        done(2, 1, 'B1'),
        done(3, 2, 'B1'),
      ];
      expect(recommendNextTask(attempts)).toEqual({ task: 1, reason: 'never-tried' });
    });

    it('beats a lower level on another task', () => {
      expect(recommendNextTask([done(1, 1, 'C2'), done(2, 2, 'A1')])).toEqual({
        task: 3,
        reason: 'never-tried',
      });
    });
  });

  describe('lowest-level', () => {
    it('recommends the task with the lowest latest level', () => {
      expect(recommendNextTask([done(1, 1, 'B2'), done(2, 2, 'A2'), done(3, 3, 'C1')])).toEqual({
        task: 2,
        reason: 'lowest-level',
      });
      expect(recommendNextTask([done(1, 3, 'A1'), done(2, 2, 'A2'), done(3, 1, 'C1')])).toEqual({
        task: 1,
        reason: 'lowest-level',
      });
      expect(recommendNextTask([done(1, 1, 'C2'), done(2, 2, 'C1'), done(3, 3, 'B2')])).toEqual({
        task: 3,
        reason: 'lowest-level',
      });
    });

    it('uses the most recent attempt by startedAt, whatever the array order', () => {
      const attempts = [done(1, 20, 'C1'), done(1, 1, 'A1'), done(2, 5, 'B1'), done(3, 6, 'B2')];
      expect(recommendNextTask(attempts)).toEqual({ task: 2, reason: 'lowest-level' });
      expect(recommendNextTask([...attempts].reverse())).toEqual({
        task: 2,
        reason: 'lowest-level',
      });
    });

    it('a recent low level makes the task the weakest', () => {
      const attempts = [done(1, 1, 'C1'), done(1, 20, 'A1'), done(2, 5, 'B1'), done(3, 6, 'B2')];
      expect(recommendNextTask(attempts)).toEqual({ task: 1, reason: 'lowest-level' });
    });

    it('skips a more recent completed attempt without a level', () => {
      const attempts = [done(1, 1, 'A1'), done(1, 20, null), done(2, 5, 'B1'), done(3, 6, 'B2')];
      expect(recommendNextTask(attempts)).toEqual({ task: 1, reason: 'lowest-level' });
    });

    it.each(['in_progress', 'interrupted'] as const)(
      'ignores the level of a more recent %s attempt',
      (status) => {
        const attempts: Attempt[] = [
          done(1, 1, 'A1'),
          { task: 1, startedAt: at(20), globalLevel: 'C2', status },
          done(2, 5, 'B1'),
          done(3, 6, 'B2'),
        ];
        expect(recommendNextTask(attempts)).toEqual({ task: 1, reason: 'lowest-level' });
      }
    );

    it('works with exactly two graded tasks and leaves the ungraded one out', () => {
      // Tâche 1 is completed but never graded and is the oldest: not picked.
      expect(recommendNextTask([done(1, 1), done(2, 5, 'B2'), done(3, 6, 'A2')])).toEqual({
        task: 3,
        reason: 'lowest-level',
      });
      expect(recommendNextTask([done(1, 9, 'A2'), done(2, 5, 'B2'), done(3, 1)])).toEqual({
        task: 1,
        reason: 'lowest-level',
      });
    });

    it('breaks a tie among the lowest by the oldest latest attempt', () => {
      expect(recommendNextTask([done(1, 9, 'A2'), done(2, 4, 'A2'), done(3, 1, 'C1')])).toEqual({
        task: 2,
        reason: 'lowest-level',
      });
      expect(recommendNextTask([done(1, 4, 'A2'), done(2, 9, 'A2'), done(3, 1, 'C1')])).toEqual({
        task: 1,
        reason: 'lowest-level',
      });
      expect(recommendNextTask([done(1, 1, 'C1'), done(2, 9, 'B1'), done(3, 4, 'B1')])).toEqual({
        task: 3,
        reason: 'lowest-level',
      });
    });

    it('breaks a tie of level and date by the lower task number', () => {
      expect(recommendNextTask([done(1, 1, 'C1'), done(3, 4, 'B1'), done(2, 4, 'B1')])).toEqual({
        task: 2,
        reason: 'lowest-level',
      });
      expect(recommendNextTask([done(3, 4, 'A1'), done(2, 9, 'C2'), done(1, 4, 'A1')])).toEqual({
        task: 1,
        reason: 'lowest-level',
      });
    });

    it('dates the tie-break with the latest completed attempt, graded or not', () => {
      // Tâche 1: graded on day 1, then a newer ungraded completion on day 20.
      // Tâche 2: graded on day 10. Same level, so tâche 2 (latest day 10) is older.
      const attempts = [done(1, 1, 'A2'), done(1, 20), done(2, 10, 'A2'), done(3, 2, 'C1')];
      expect(recommendNextTask(attempts)).toEqual({ task: 2, reason: 'lowest-level' });
    });
  });

  describe('least-recent', () => {
    it('is used when all graded levels are equal', () => {
      expect(recommendNextTask([done(1, 5, 'B1'), done(2, 2, 'B1'), done(3, 9, 'B1')])).toEqual({
        task: 2,
        reason: 'least-recent',
      });
    });

    it('is used when the two graded levels are equal', () => {
      expect(recommendNextTask([done(1, 5, 'B1'), done(2, 9, 'B1'), done(3, 2)])).toEqual({
        task: 3,
        reason: 'least-recent',
      });
    });

    it('is used when only one task has a level', () => {
      expect(recommendNextTask([done(1, 5, 'A1'), done(2, 9), done(3, 2)])).toEqual({
        task: 3,
        reason: 'least-recent',
      });
      expect(recommendNextTask([done(1, 1), done(2, 9), done(3, 2, 'A1')])).toEqual({
        task: 1,
        reason: 'least-recent',
      });
    });

    it('is used when no task has a level', () => {
      expect(recommendNextTask([done(1, 5), done(2, 9), done(3, 2)])).toEqual({
        task: 3,
        reason: 'least-recent',
      });
    });

    it('compares the latest completed attempt of each task', () => {
      // Tâche 1 has the oldest attempt overall but was practised most recently.
      const attempts = [done(1, 1), done(1, 20), done(2, 8), done(3, 12)];
      expect(recommendNextTask(attempts)).toEqual({ task: 2, reason: 'least-recent' });
      expect(recommendNextTask([...attempts].reverse())).toEqual({
        task: 2,
        reason: 'least-recent',
      });
    });

    it.each(['in_progress', 'interrupted'] as const)(
      'ignores a more recent %s attempt',
      (status) => {
        const attempts: Attempt[] = [
          done(1, 5),
          done(2, 2),
          { task: 2, startedAt: at(25), globalLevel: null, status },
          done(3, 9),
        ];
        expect(recommendNextTask(attempts)).toEqual({ task: 2, reason: 'least-recent' });
      }
    );

    it('breaks a date tie by the lower task number', () => {
      expect(recommendNextTask([done(3, 2), done(2, 2), done(1, 9)])).toEqual({
        task: 2,
        reason: 'least-recent',
      });
      expect(recommendNextTask([done(3, 2), done(2, 2), done(1, 2)])).toEqual({
        task: 1,
        reason: 'least-recent',
      });
    });
  });

  it('does not mutate its input', () => {
    const attempts = deepFreeze([
      done(1, 20, 'C1'),
      done(1, 1, 'A1'),
      done(2, 5, 'B1'),
      done(3, 6, 'B2'),
    ]);
    const copy = JSON.parse(JSON.stringify(attempts));
    expect(() => recommendNextTask(attempts as Attempt[])).not.toThrow();
    expect(attempts).toEqual(copy);
  });
});
