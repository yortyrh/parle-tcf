import { type AttemptSummary, type CefrLevel, levelScore } from '@parle-tcf/shared';

export interface LevelPoint {
  id: string;
  date: string;
  level: CefrLevel;
  score: number;
}

type SeriesAttempt = Pick<AttemptSummary, 'id' | 'task' | 'startedAt' | 'globalLevel'>;

/** Graded attempts of one task, oldest first, as chart points. */
export function levelSeries(attempts: SeriesAttempt[], task: number): LevelPoint[] {
  return attempts
    .filter((a) => a.task === task && a.globalLevel !== null)
    .map((a) => ({
      id: a.id,
      date: a.startedAt,
      level: a.globalLevel!,
      score: levelScore(a.globalLevel!),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Last point against the mean of the `window` points before it. */
export function levelTrend(points: LevelPoint[], window = 3): 'up' | 'down' | 'flat' | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const before = points.slice(Math.max(0, points.length - 1 - window), points.length - 1);
  const mean = before.reduce((sum, p) => sum + p.score, 0) / before.length;
  if (last.score > mean) return 'up';
  if (last.score < mean) return 'down';
  return 'flat';
}

/** Width of a CEFR bar: A1 → 17 %, C2 → 100 %. */
export function levelPercent(level: CefrLevel | null): number {
  return level ? Math.round((levelScore(level) / 6) * 100) : 0;
}
