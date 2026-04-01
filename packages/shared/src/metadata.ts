import type { TaskType } from "./task-types";

export interface ParticipantMetadata {
  taskType: TaskType;
  exerciseId?: string;
}
