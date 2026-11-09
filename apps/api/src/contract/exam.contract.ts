import { oc, populateContractRouterPaths } from "@orpc/contract";
import {
  createExamSessionInputSchema,
  createExamSessionOutputSchema,
} from "@parle-tcf/shared";

export const createExamSessionProcedure = oc
  .route({ method: "POST", path: "/exam/session/create" })
  .input(createExamSessionInputSchema)
  .output(createExamSessionOutputSchema);

export const examContract = populateContractRouterPaths({
  exam: {
    session: {
      create: createExamSessionProcedure,
    },
  },
});
