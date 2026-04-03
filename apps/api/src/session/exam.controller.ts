import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import type { CreateExamSessionInput } from "@yorty-tcf/shared";
import { createExamSessionProcedure } from "../contract/exam.contract.js";
import { ExamSessionService } from "./exam-session.service.js";

@Controller()
export class ExamController {
  constructor(private readonly examSession: ExamSessionService) {}

  @Implement(createExamSessionProcedure)
  createExamSession() {
    return implement(createExamSessionProcedure).handler(
      async ({ input }: { input: CreateExamSessionInput }) => {
        return this.examSession.createSession(input);
      },
    );
  }
}
