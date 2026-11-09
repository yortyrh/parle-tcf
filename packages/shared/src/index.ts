export type { TaskType } from "./task-types";
export { TCF_TASK_TYPES, TASK_DURATIONS } from "./task-types";

export * from "./schemas/exam-session";
export * from "./schemas/provider-settings";
export * from "./schemas/attempts";
export * from "./schemas/evaluation";
export * from "./pricing";

/** HTTP route of every API procedure (all POST + JSON, cookie session). */
export const API_ROUTES = {
  sessionCreate: "/exam/session/create",
  settingsGet: "/settings/get",
  settingsUpsert: "/settings/upsert",
  settingsDelete: "/settings/delete",
  settingsTest: "/settings/test",
  attemptsCheckpoint: "/attempts/checkpoint",
  attemptsComplete: "/attempts/complete",
  attemptsList: "/attempts/list",
  attemptsGet: "/attempts/get",
  attemptsDelete: "/attempts/delete",
  attemptsReevaluate: "/attempts/reevaluate",
  usageGet: "/usage/get",
} as const;
