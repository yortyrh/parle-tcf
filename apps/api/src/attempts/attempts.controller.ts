import { Controller, Req, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { currentUserId } from "../auth/current-user.js";
import {
  type AuthenticatedRequest,
  SessionAuthGuard,
} from "../auth/session-auth.guard.js";
import {
  attemptsCheckpointProcedure,
  attemptsCompleteProcedure,
  attemptsDeleteProcedure,
  attemptsGetProcedure,
  attemptsListProcedure,
} from "../contract/exam.contract.js";
import { AttemptsService } from "./attempts.service.js";

@Controller()
@UseGuards(SessionAuthGuard)
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Implement(attemptsCheckpointProcedure)
  checkpoint(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(attemptsCheckpointProcedure).handler(async ({ input }) => {
      await this.attempts.checkpoint(userId, input.attemptId, input.lines);
      return { ok: true as const };
    });
  }

  @Implement(attemptsCompleteProcedure)
  complete(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(attemptsCompleteProcedure).handler(async ({ input }) => {
      await this.attempts.complete(userId, input);
      return { ok: true as const };
    });
  }

  @Implement(attemptsListProcedure)
  list(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(attemptsListProcedure).handler(({ input }) =>
      this.attempts.list(userId, input),
    );
  }

  @Implement(attemptsGetProcedure)
  get(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(attemptsGetProcedure).handler(({ input }) =>
      this.attempts.get(userId, input.attemptId),
    );
  }

  @Implement(attemptsDeleteProcedure)
  delete(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(attemptsDeleteProcedure).handler(async ({ input }) => {
      await this.attempts.delete(userId, input.attemptId);
      return { ok: true as const };
    });
  }
}
