import { Controller, Req, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { currentUserId } from "../auth/current-user.js";
import {
  type AuthenticatedRequest,
  SessionAuthGuard,
} from "../auth/session-auth.guard.js";
import {
  createExamSessionProcedure,
  refreshSessionTokenProcedure,
} from "../contract/exam.contract.js";
import { ExamSessionService } from "./exam-session.service.js";

@Controller()
@UseGuards(SessionAuthGuard)
export class ExamController {
  constructor(private readonly examSession: ExamSessionService) {}

  @Implement(createExamSessionProcedure)
  createExamSession(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(createExamSessionProcedure).handler(({ input }) =>
      this.examSession.createSession(userId, input),
    );
  }

  @Implement(refreshSessionTokenProcedure)
  refreshSessionToken(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(refreshSessionTokenProcedure).handler(({ input }) =>
      this.examSession.refreshToken(userId, input),
    );
  }
}
