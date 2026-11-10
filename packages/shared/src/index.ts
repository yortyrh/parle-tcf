export type { TaskType } from './task-types';
export { TCF_TASK_TYPES, TASK_DURATIONS } from './task-types';

export * from './schemas/exam-session';
export * from './schemas/provider-settings';
export * from './schemas/attempts';
export * from './schemas/evaluation';
export * from './schemas/audio';
export * from './schemas/exercises';
export * from './pricing';

/** HTTP route of every API procedure (all POST + JSON, cookie session). */
export const API_ROUTES = {
  sessionCreate: '/exam/session/create',
  sessionToken: '/exam/session/token',
  settingsGet: '/settings/get',
  settingsUpsert: '/settings/upsert',
  settingsDelete: '/settings/delete',
  settingsTest: '/settings/test',
  attemptsCheckpoint: '/attempts/checkpoint',
  attemptsComplete: '/attempts/complete',
  attemptsList: '/attempts/list',
  attemptsGet: '/attempts/get',
  attemptsDelete: '/attempts/delete',
  attemptsReevaluate: '/attempts/reevaluate',
  runsGet: '/runs/get',
  usageGet: '/usage/get',
  audioStatus: '/audio/status',
  audioSetConsent: '/audio/consent',
  audioUploadUrl: '/audio/upload-url',
  audioConfirm: '/audio/confirm',
  audioDownloadUrl: '/audio/download-url',
  exercisesList: '/exercises/list',
  exercisesSessions: '/exercises/sessions',
  /** Public (no session): landing page teaser. */
  exercisesFeatured: '/exercises/featured',
} as const;
