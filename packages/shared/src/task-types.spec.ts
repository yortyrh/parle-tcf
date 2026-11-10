import { describe, expect, it, vi } from 'vitest';

// Re-imported fresh inside each test (not at the top) so that Stryker's static
// mutants of these module-level constants are active when the module is evaluated.
const load = () => {
  vi.resetModules();
  return import('./task-types');
};

describe('TCF_TASK_TYPES', () => {
  it('lists the three speaking tasks in exam order', async () => {
    const { TCF_TASK_TYPES } = await load();
    expect(TCF_TASK_TYPES).toEqual(['tache1', 'tache2', 'tache3']);
  });

  it('has a duration for every task', async () => {
    const { TASK_DURATIONS, TCF_TASK_TYPES } = await load();
    expect(Object.keys(TASK_DURATIONS)).toEqual([...TCF_TASK_TYPES]);
  });
});
