import { describe, expect, it } from 'vitest';
import { remainingSeconds } from './useCountdown';

describe('remainingSeconds', () => {
  it('rounds partial seconds up and never goes negative', () => {
    expect(remainingSeconds(10_000, 0)).toBe(10);
    expect(remainingSeconds(10_000, 9_001)).toBe(1);
    expect(remainingSeconds(10_000, 10_000)).toBe(0);
    expect(remainingSeconds(10_000, 25_000)).toBe(0);
  });
});
