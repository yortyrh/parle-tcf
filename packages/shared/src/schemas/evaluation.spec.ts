import { describe, expect, it } from 'vitest';
import { estimateCost } from '../pricing';
import { weightedMedianLevel } from './evaluation';

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
});

describe('estimateCost', () => {
  it('prices known models and returns null for unknown ones', () => {
    expect(estimateCost('gpt-4o-mini', 1_000_000, 1_000_000)).toBeCloseTo(0.75);
    expect(estimateCost('mystery', 10, 10)).toBeNull();
  });
});
