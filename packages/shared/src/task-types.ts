export type TaskType = 'tache1' | 'tache2' | 'tache3';

export const TCF_TASK_TYPES: readonly TaskType[] = ['tache1', 'tache2', 'tache3'];

/** Official TCF Canada speaking times, in seconds. */
export const TASK_DURATIONS: Record<TaskType, { preparationS: number; speakingS: number }> = {
  tache1: { preparationS: 0, speakingS: 2 * 60 },
  tache2: { preparationS: 2 * 60, speakingS: 3 * 60 + 30 },
  tache3: { preparationS: 0, speakingS: 4 * 60 + 30 },
};
