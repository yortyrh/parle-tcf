import { oc, populateContractRouterPaths } from "@orpc/contract";
import {
  API_ROUTES,
  attemptDetailSchema,
  attemptIdInputSchema,
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
});
