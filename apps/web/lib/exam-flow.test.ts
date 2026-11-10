import { describe, expect, it } from 'vitest';
import { canCompare, restartOptions } from './exam-flow';

const RUN = '33333333-3333-4333-8333-333333333333';

describe('restartOptions', () => {
  it('keeps the run of a full exam', () => {
    expect(restartOptions('full', RUN)).toEqual({ mode: 'full', runId: RUN });
  });

  it('omits the run id of a full exam that has none yet', () => {
    const out = restartOptions('full', null);
    expect(out).toEqual({ mode: 'full' });
    expect(out).not.toHaveProperty('runId');
  });

  it('never sends a run id in practice mode', () => {
    for (const runId of [RUN, null]) {
      const out = restartOptions('practice', runId);
      expect(out).toEqual({ mode: 'practice' });
      expect(out).not.toHaveProperty('runId');
    }
  });
});

describe('canCompare', () => {
  const a = { task: 2, exerciseId: 'x-t2-1' };

  it('is true for the same subject of the same task', () => {
    expect(canCompare(a, { task: 2, exerciseId: 'x-t2-1' })).toBe(true);
  });

  it('is false for different subjects', () => {
    expect(canCompare(a, { task: 2, exerciseId: 'x-t2-2' })).toBe(false);
  });

  it('is false for different tasks with the same id', () => {
    expect(canCompare(a, { task: 3, exerciseId: 'x-t2-1' })).toBe(false);
  });

  it('is false when either subject is unknown', () => {
    expect(canCompare(a, { task: 2, exerciseId: null })).toBe(false);
    expect(canCompare({ task: 2, exerciseId: null }, a)).toBe(false);
    expect(canCompare({ task: 2, exerciseId: null }, { task: 2, exerciseId: null })).toBe(false);
  });
});
