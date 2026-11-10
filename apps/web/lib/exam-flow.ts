import type { AttemptMode, AttemptSummary } from '@parle-tcf/shared';

/**
 * Options to restart a task or switch exercise: a full exam stays in the same
 * run (same mode and run id); practice never carries a run id.
 */
export function restartOptions(
  mode: AttemptMode,
  runId: string | null
): { mode: AttemptMode; runId?: string } {
  if (mode === 'full') return runId ? { mode: 'full', runId } : { mode: 'full' };
  return { mode: 'practice' };
}

type Comparable = Pick<AttemptSummary, 'task' | 'exerciseId'>;

/** Two attempts are comparable only on the same subject of the same task. */
export function canCompare(a: Comparable, b: Comparable): boolean {
  return a.exerciseId !== null && a.exerciseId === b.exerciseId && a.task === b.task;
}
