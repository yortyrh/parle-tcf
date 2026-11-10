import { oc, populateContractRouterPaths } from "@orpc/contract";
import {
  API_ROUTES,
  attemptDetailSchema,
  attemptIdInputSchema,
  audioDownloadOutputSchema,
  audioStatusSchema,
  audioUploadInputSchema,
  audioUploadOutputSchema,
  audioConfirmInputSchema,
  checkpointAttemptOutputSchema,
  examRunSchema,
  getRunInputSchema,
  refreshSessionTokenInputSchema,
  refreshSessionTokenOutputSchema,
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
  featuredExercisesOutputSchema,
} from "@parle-tcf/shared";
import { z } from "zod";

const post = (path: `/${string}`) => oc.route({ method: "POST", path });

export const createExamSessionProcedure = post(API_ROUTES.sessionCreate)
  .input(createExamSessionInputSchema)
  .output(createExamSessionOutputSchema);
export const refreshSessionTokenProcedure = post(API_ROUTES.sessionToken)
  .input(refreshSessionTokenInputSchema)
  .output(refreshSessionTokenOutputSchema);

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
  .output(checkpointAttemptOutputSchema);
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
export const runsGetProcedure = post(API_ROUTES.runsGet)
  .input(getRunInputSchema)
  .output(examRunSchema);
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
export const audioConfirmProcedure = post(API_ROUTES.audioConfirm)
  .input(audioConfirmInputSchema)
  .output(okOutputSchema);
export const audioDownloadUrlProcedure = post(API_ROUTES.audioDownloadUrl)
  .input(attemptIdInputSchema)
  .output(audioDownloadOutputSchema);

export const exercisesListProcedure = post(API_ROUTES.exercisesList)
  .input(listExercisesInputSchema)
  .output(listExercisesOutputSchema);
export const exercisesSessionsProcedure = post(API_ROUTES.exercisesSessions)
  .input(z.object({}).optional())
  .output(listExerciseSessionsOutputSchema);

export const exercisesFeaturedProcedure = post(API_ROUTES.exercisesFeatured)
  .input(z.object({}).optional())
  .output(featuredExercisesOutputSchema);

export const examContract = populateContractRouterPaths({
  exam: {
    session: {
      create: createExamSessionProcedure,
      token: refreshSessionTokenProcedure,
    },
  },
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
  runs: { get: runsGetProcedure },
  usage: { get: usageGetProcedure },
  audio: {
    status: audioStatusProcedure,
    setConsent: audioSetConsentProcedure,
    uploadUrl: audioUploadUrlProcedure,
    confirm: audioConfirmProcedure,
    downloadUrl: audioDownloadUrlProcedure,
  },
  exercises: {
    list: exercisesListProcedure,
    sessions: exercisesSessionsProcedure,
    featured: exercisesFeaturedProcedure,
  },
});
