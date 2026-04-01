export type TaskType =
  | "tache1"
  | "tache2"
  | "tache3"
  | "tef-section-a"
  | "tef-section-b";

export const TCF_TASK_TYPES: readonly TaskType[] = [
  "tache1",
  "tache2",
  "tache3",
];

export const TEF_TASK_TYPES: readonly TaskType[] = [
  "tef-section-a",
  "tef-section-b",
];

export const ALL_TASK_TYPES: readonly TaskType[] = [
  ...TCF_TASK_TYPES,
  ...TEF_TASK_TYPES,
];
