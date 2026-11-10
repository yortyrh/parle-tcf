import { oc, populateContractRouterPaths } from "@orpc/contract";
import {
  API_ROUTES,
  attemptDetailSchema,
  attemptIdInputSchema,
  audioDownloadOutputSchema,
  audioStatusSchema,
  audioUploadInputSchema,
  audioUploadOutputSchema,
  setAudioConsentInputSchema,
  checkpointAttemptInputSchema,
  completeAttemptInputSchema,
  createExamSessionInputSchema,
  createExamSessionOutputSchema,
  listAttemptsInputSchema,
  listAttemptsOutputSchema,
  okOutputSchema,
  providerSettingsSchema,
  usageSchema,
  testProviderSettingsOutputSchema,
  upsertProviderSettingsInputSchema,
  listExercisesInputSchema,
  listExercisesOutputSchema,
  listExerciseSessionsOutputSchema,
} from "@parle-tcf/shared";
import { z } from "zod";

const post = (path: `/${string}`) => oc.route({ method: "POST", path });

export const createExamSessionProcedure = post(API_ROUTES.sessionCreate)
  .input(createExamSessionInputSchema)
  .output(createExamSessionOutputSchema);

export const settingsGetProcedure = post(API_ROUTES.settingsGet)
  .input(z.object({}).optional())
  .output(providerSettingsSchema);
export const settingsUpsertProcedure = post(API_ROUTES.settingsUpsert)
  .input(upsertProviderSettingsInputSchema)
  .output(providerSettingsSchema);
export const settingsDeleteProcedure = post(API_ROUTES.settingsDelete)
  .input(z.object({}).optional())
  .output(okOutputSchema);
export const settingsTestProcedure = post(API_ROUTES.settingsTest)
  .input(z.object({}).optional())
  .output(testProviderSettingsOutputSchema);

export const attemptsCheckpointProcedure = post(API_ROUTES.attemptsCheckpoint)
  .input(checkpointAttemptInputSchema)
  .output(okOutputSchema);
export const attemptsCompleteProcedure = post(API_ROUTES.attemptsComplete)
  .input(completeAttemptInputSchema)
  .output(okOutputSchema);
export const attemptsListProcedure = post(API_ROUTES.attemptsList)
  .input(listAttemptsInputSchema)
  .output(listAttemptsOutputSchema);
export const attemptsGetProcedure = post(API_ROUTES.attemptsGet)
  .input(attemptIdInputSchema)
  .output(attemptDetailSchema);
export const attemptsDeleteProcedure = post(API_ROUTES.attemptsDelete)
  .input(attemptIdInputSchema)
  .output(okOutputSchema);

export const attemptsReevaluateProcedure = post(API_ROUTES.attemptsReevaluate)
  .input(attemptIdInputSchema)
  .output(okOutputSchema);
export const usageGetProcedure = post(API_ROUTES.usageGet)
  .input(z.object({}).optional())
  .output(usageSchema);

export const audioStatusProcedure = post(API_ROUTES.audioStatus)
  .input(z.object({}).optional())
  .output(audioStatusSchema);
export const audioSetConsentProcedure = post(API_ROUTES.audioSetConsent)
  .input(setAudioConsentInputSchema)
  .output(audioStatusSchema);
export const audioUploadUrlProcedure = post(API_ROUTES.audioUploadUrl)
  .input(audioUploadInputSchema)
  .output(audioUploadOutputSchema);
export const audioDownloadUrlProcedure = post(API_ROUTES.audioDownloadUrl)
  .input(attemptIdInputSchema)
  .output(audioDownloadOutputSchema);

export const exercisesListProcedure = post(API_ROUTES.exercisesList)
  .input(listExercisesInputSchema)
  .output(listExercisesOutputSchema);
export const exercisesSessionsProcedure = post(API_ROUTES.exercisesSessions)
  .input(z.object({}).optional())
  .output(listExerciseSessionsOutputSchema);

export const examContract = populateContractRouterPaths({
  exam: { session: { create: createExamSessionProcedure } },
  settings: {
    get: settingsGetProcedure,
    upsert: settingsUpsertProcedure,
    delete: settingsDeleteProcedure,
    test: settingsTestProcedure,
  },
  attempts: {
    checkpoint: attemptsCheckpointProcedure,
    complete: attemptsCompleteProcedure,
    list: attemptsListProcedure,
    get: attemptsGetProcedure,
    delete: attemptsDeleteProcedure,
    reevaluate: attemptsReevaluateProcedure,
  },
  usage: { get: usageGetProcedure },
  audio: {
    status: audioStatusProcedure,
    setConsent: audioSetConsentProcedure,
    uploadUrl: audioUploadUrlProcedure,
    downloadUrl: audioDownloadUrlProcedure,
  },
  exercises: {
    list: exercisesListProcedure,
    sessions: exercisesSessionsProcedure,
  },
});
