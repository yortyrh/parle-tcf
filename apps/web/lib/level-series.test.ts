import { describe, expect, it } from 'vitest';
import type { AttemptSummary, CefrLevel } from '@parle-tcf/shared';
import { type LevelPoint, levelPercent, levelSeries, levelTrend } from './level-series';

type Attempt = Pick<AttemptSummary, 'id' | 'task' | 'startedAt' | 'globalLevel'>;

const at = (day: number) => `2026-03-${String(day).padStart(2, '0')}T09:00:00.000Z`;

const attempt = (id: string, task: number, day: number, level: CefrLevel | null): Attempt => ({
  id,
  task,
  startedAt: at(day),
  globalLevel: level,
});

const SCORES: Record<CefrLevel, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
const LEVEL_BY_SCORE = Object.fromEntries(Object.entries(SCORES).map(([l, s]) => [s, l])) as Record<
  number,
  CefrLevel
>;

const points = (scores: number[]): LevelPoint[] =>
  scores.map((score, i) => ({
    id: `p${i}`,
    date: at(i + 1),
    level: LEVEL_BY_SCORE[score]!,
    score,
  }));

describe('levelSeries', () => {
  it('keeps the graded attempts of the task, oldest first, with their score', () => {
    const attempts = [
      attempt('c', 2, 9, 'B2'),
      attempt('x', 3, 4, 'C2'),
      attempt('a', 2, 1, 'A2'),
      attempt('n', 2, 5, null),
      attempt('b', 2, 3, 'C1'),
      attempt('y', 1, 2, 'A1'),
    ];
    expect(levelSeries(attempts, 2)).toEqual([
      { id: 'a', date: at(1), level: 'A2', score: 2 },
      { id: 'b', date: at(3), level: 'C1', score: 5 },
      { id: 'c', date: at(9), level: 'B2', score: 4 },
    ]);
  });

  it('scores every level from A1 = 1 to C2 = 6', () => {
    const levels = Object.keys(SCORES) as CefrLevel[];
    const attempts = levels.map((level, i) => attempt(level, 1, i + 1, level));
    expect(levelSeries(attempts, 1).map((p) => [p.level, p.score])).toEqual(
      levels.map((l) => [l, SCORES[l]])
    );
  });

  it('returns an empty series without graded attempts of the task', () => {
    expect(levelSeries([], 1)).toEqual([]);
    expect(levelSeries([attempt('a', 1, 1, null), attempt('b', 2, 2, 'B1')], 1)).toEqual([]);
    expect(levelSeries([attempt('a', 1, 1, 'B1')], 3)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const attempts = Object.freeze([
      Object.freeze(attempt('c', 2, 9, 'B2')),
      Object.freeze(attempt('a', 2, 1, 'A2')),
    ]);
    const copy = JSON.parse(JSON.stringify(attempts));
    expect(levelSeries(attempts as Attempt[], 2).map((p) => p.id)).toEqual(['a', 'c']);
    expect(attempts).toEqual(copy);
  });
});

describe('levelTrend', () => {
  it('is null with fewer than 2 points', () => {
    expect(levelTrend([])).toBeNull();
    expect(levelTrend(points([4]))).toBeNull();
    expect(levelTrend(points([4]), 1)).toBeNull();
  });

  it('compares 2 points', () => {
    expect(levelTrend(points([2, 3]))).toBe('up');
    expect(levelTrend(points([3, 2]))).toBe('down');
    expect(levelTrend(points([3, 3]))).toBe('flat');
  });

  it('compares the last score with the mean of the 3 points before it by default', () => {
    // Mean of [1, 1, 1] = 1 < 2. With a window of 4, mean of [6, 1, 1, 1] = 2.25 > 2.
    expect(levelTrend(points([6, 1, 1, 1, 2]))).toBe('up');
    expect(levelTrend(points([6, 1, 1, 1, 2]), 3)).toBe('up');
    expect(levelTrend(points([6, 1, 1, 1, 2]), 4)).toBe('down');
  });

  it('uses the points just before the last one, not the first ones', () => {
    // Before the last: [6, 6, 6] → mean 6 > 5. The first three [1, 6, 6] average 4.33.
    expect(levelTrend(points([1, 6, 6, 6, 5]))).toBe('down');
    expect(levelTrend(points([6, 1, 1, 1, 2]))).toBe('up');
  });

  it('honours a custom window', () => {
    // Window 1: previous point 1 < 3. Window 2: mean of [6, 1] = 3.5 > 3.
    expect(levelTrend(points([6, 6, 1, 3]), 1)).toBe('up');
    expect(levelTrend(points([6, 6, 1, 3]), 2)).toBe('down');
    expect(levelTrend(points([6, 6, 1, 3]), 3)).toBe('down');
  });

  it('is flat when the last score equals the mean', () => {
    expect(levelTrend(points([1, 3, 2]))).toBe('flat');
    expect(levelTrend(points([5, 1, 3, 3]))).toBe('flat');
  });

  it('uses every earlier point when there are fewer than the window', () => {
    // Mean of [1, 4] = 2.5 < 3 (the previous point alone, 4, would give 'down').
    expect(levelTrend(points([1, 4, 3]), 10)).toBe('up');
    expect(levelTrend(points([5, 4, 4]), 10)).toBe('down');
  });

  it('does not mutate its input', () => {
    const pts = Object.freeze(points([6, 1, 1, 1, 2]).map((p) => Object.freeze(p)));
    const copy = JSON.parse(JSON.stringify(pts));
    expect(levelTrend(pts as LevelPoint[])).toBe('up');
    expect(pts).toEqual(copy);
  });
});

describe('levelPercent', () => {
  it.each([
    ['A1', 17],
    ['A2', 33],
    ['B1', 50],
    ['B2', 67],
    ['C1', 83],
    ['C2', 100],
  ] as const)('maps %s to %i', (level, percent) => {
    expect(levelPercent(level)).toBe(percent);
  });

  it('maps no level to 0', () => {
    expect(levelPercent(null)).toBe(0);
  });
});
