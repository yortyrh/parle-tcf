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
  runsGetProcedure,
  usageGetProcedure,
} from "../contract/exam.contract.js";
import { AudioService } from "../audio/audio.service.js";
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
    private readonly audio: AudioService,
  ) {}

  @Implement(attemptsCheckpointProcedure)
  checkpoint(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(attemptsCheckpointProcedure).handler(async ({ input }) => {
      await this.attempts.checkpoint(userId, input.attemptId, input.lines);
      // Long sessions re-check the limits: the client ends the session when reached.
      const limitReached = await this.usage.isOverLimit(userId);
      return { ok: true as const, limitReached };
    });
  }

  @Implement(attemptsCompleteProcedure)
  complete(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(attemptsCompleteProcedure).handler(async ({ input }) => {
      // Only the call that actually completes the attempt starts its evaluation.
      if (await this.attempts.complete(userId, input)) {
        this.evaluation.start(userId, input.attemptId);
      }
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
      await this.audio.deleteForAttempt(userId, input.attemptId);
      await this.attempts.delete(userId, input.attemptId);
      return { ok: true as const };
    });
  }

  @Implement(attemptsReevaluateProcedure)
  reevaluate(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(attemptsReevaluateProcedure).handler(async ({ input }) => {
      const result = await this.evaluation.requeue(userId, input.attemptId);
      if (result === "running") {
        throw new ORPCError("CONFLICT", {
          status: 409,
          message: "L'évaluation est déjà en cours.",
        });
      }
      if (result === "not_found") {
        throw new ORPCError("NOT_FOUND", { message: "Tentative introuvable." });
      }
      return { ok: true as const };
    });
  }

  @Implement(runsGetProcedure)
  runsGet(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(runsGetProcedure).handler(({ input }) =>
      this.attempts.getRun(userId, input.runId),
    );
  }

  @Implement(usageGetProcedure)
  usageGet(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(usageGetProcedure).handler(() => this.usage.get(userId));
  }
}
