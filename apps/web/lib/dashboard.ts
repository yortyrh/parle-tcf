import { type AttemptSummary, levelScore } from '@parle-tcf/shared';

export interface Recommendation {
  task: 1 | 2 | 3;
  reason: 'never-tried' | 'lowest-level' | 'least-recent';
}

type DashboardAttempt = Pick<AttemptSummary, 'task' | 'globalLevel' | 'startedAt' | 'status'>;

const TASKS = [1, 2, 3] as const;

/**
 * Next task to practise: an untried task first, then the weakest level, then
 * the task left aside the longest. Only completed attempts count.
 */
export function recommendNextTask(attempts: DashboardAttempt[]): Recommendation {
  const completed = attempts.filter((a) => a.status === 'completed');
  const byTask = TASKS.map((task) => {
    const own = completed
      .filter((a) => a.task === task)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const latestGraded = own.find((a) => a.globalLevel !== null);
    return {
      task,
      latestAt: own[0]?.startedAt ?? null,
      score: latestGraded?.globalLevel ? levelScore(latestGraded.globalLevel) : null,
    };
  });

  const untried = byTask.find((t) => t.latestAt === null);
  if (untried) return { task: untried.task, reason: 'never-tried' };

  // Every task has a completed attempt from here on.
  const oldestFirst = (a: (typeof byTask)[number], b: (typeof byTask)[number]) =>
    a.latestAt.localeCompare(b.latestAt) || a.task - b.task;

  const graded = byTask.filter((t) => t.score !== null);
  const scores = graded.map((t) => t.score!);
  if (graded.length >= 2 && Math.min(...scores) !== Math.max(...scores)) {
    const lowest = Math.min(...scores);
    const weakest = graded.filter((t) => t.score === lowest).sort(oldestFirst)[0];
    return { task: weakest.task, reason: 'lowest-level' };
  }

  return { task: [...byTask].sort(oldestFirst)[0].task, reason: 'least-recent' };
}
