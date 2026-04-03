export type { TaskType } from "./task-types";
export { TCF_TASK_TYPES, TEF_TASK_TYPES, ALL_TASK_TYPES } from "./task-types";

export type { ParticipantMetadata } from "./metadata";

export type {
  ExerciseData,
  ExerciseDataMessage,
  ExerciseImageMessage,
  ReportMessage,
  ReportMultipartMessage,
  ReportPartMessage,
  SessionEndMessage,
  SessionRestartMessage,
  RestartTestMessage,
  AgentToWebMessage,
  WebToAgentMessage,
  DataMessage,
} from "./messages";

export {
  taskTypeSchema,
  createExamSessionInputSchema,
  createExamSessionOutputSchema,
  exerciseDataPayloadSchema,
  exerciseImagePayloadSchema,
  agentConfigForClientSchema,
} from "./schemas/exam-session";
export type {
  CreateExamSessionInput,
  CreateExamSessionOutput,
  ExerciseImagePayload,
} from "./schemas/exam-session";

export { SOCKET_EVENTS } from "./socket-events";
export type {
  JoinSessionPayload,
  SessionEndSocketPayload,
  ReportSocketPayload,
  SessionRestartSocketPayload,
} from "./socket-events";
