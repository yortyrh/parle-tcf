import { Controller, Req, UseGuards } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
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
  attemptsReevaluateProcedure,
  usageGetProcedure,
} from "../contract/exam.contract.js";
import { EvaluationService } from "../evaluation/evaluation.service.js";
import { UsageService } from "../usage/usage.service.js";
import { AttemptsService } from "./attempts.service.js";

@Controller()
@UseGuards(SessionAuthGuard)
export class AttemptsController {
  constructor(
    private readonly attempts: AttemptsService,
    private readonly evaluation: EvaluationService,
    private readonly usage: UsageService,
  ) {}

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
      this.evaluation.start(userId, input.attemptId);
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

  @Implement(attemptsReevaluateProcedure)
  reevaluate(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(attemptsReevaluateProcedure).handler(async ({ input }) => {
      const queued = await this.evaluation.requeue(userId, input.attemptId);
      if (!queued) {
        throw new ORPCError("NOT_FOUND", { message: "Tentative introuvable." });
      }
      return { ok: true as const };
    });
  }

  @Implement(usageGetProcedure)
  usageGet(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(usageGetProcedure).handler(() => this.usage.get(userId));
  }
}
