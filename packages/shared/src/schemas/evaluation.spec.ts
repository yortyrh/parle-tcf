import { describe, expect, it } from 'vitest';
import { estimateCost } from '../pricing';
import { CEFR_LEVELS, levelScore, scoreToLevel, weightedMedianLevel } from './evaluation';

describe('weightedMedianLevel', () => {
  it('weights the later tasks more', () => {
    expect(
      weightedMedianLevel([
        { task: 1, level: 'C1' },
        { task: 2, level: 'B1' },
        { task: 3, level: 'B1' },
      ])
    ).toBe('B1');
    expect(
      weightedMedianLevel([
        { task: 1, level: 'A2' },
        { task: 2, level: 'B2' },
        { task: 3, level: 'B2' },
      ])
    ).toBe('B2');
  });
  it('returns null without data', () => {
    expect(weightedMedianLevel([])).toBeNull();
  });
  it('returns the only level of a single task', () => {
    expect(weightedMedianLevel([{ task: 3, level: 'C2' }])).toBe('C2');
  });
  it('gives an unknown task the weight of task 1', () => {
    // Equal weights: the lower level reaches half the total first.
    expect(
      weightedMedianLevel([
        { task: 9, level: 'B2' },
        { task: 1, level: 'A2' },
      ])
    ).toBe('A2');
    expect(
      weightedMedianLevel([
        { task: 9, level: 'A2' },
        { task: 1, level: 'B2' },
      ])
    ).toBe('A2');
  });
});

describe('levelScore / scoreToLevel', () => {
  it('round-trips every CEFR level', () => {
    for (const level of CEFR_LEVELS) expect(scoreToLevel(levelScore(level))).toBe(level);
  });
  it('clamps out-of-range scores to A1 and C2', () => {
    expect(scoreToLevel(0)).toBe('A1');
    expect(scoreToLevel(-4)).toBe('A1');
    expect(scoreToLevel(7)).toBe('C2');
    expect(scoreToLevel(3.4)).toBe('B1');
    expect(scoreToLevel(3.5)).toBe('B2');
  });
});

describe('estimateCost', () => {
  it('prices known models and returns null for unknown ones', () => {
    expect(estimateCost('gpt-4o-mini', 1_000_000, 1_000_000)).toBeCloseTo(0.75);
    expect(estimateCost('mystery', 10, 10)).toBeNull();
  });
});
