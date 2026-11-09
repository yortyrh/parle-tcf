import { Controller, Req, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import {
  settingsDeleteProcedure,
  settingsGetProcedure,
  settingsTestProcedure,
  settingsUpsertProcedure,
} from "../contract/exam.contract.js";
import {
  type AuthenticatedRequest,
  SessionAuthGuard,
} from "../auth/session-auth.guard.js";
import { currentUserId } from "../auth/current-user.js";
import { ProviderSettingsService } from "./provider-settings.service.js";

@Controller()
@UseGuards(SessionAuthGuard)
export class SettingsController {
  constructor(private readonly settings: ProviderSettingsService) {}

  @Implement(settingsGetProcedure)
  get(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(settingsGetProcedure).handler(() =>
      this.settings.get(userId),
    );
  }

  @Implement(settingsUpsertProcedure)
  upsert(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(settingsUpsertProcedure).handler(({ input }) =>
      this.settings.upsert(userId, input),
    );
  }

  @Implement(settingsDeleteProcedure)
  delete(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(settingsDeleteProcedure).handler(async () => {
      await this.settings.delete(userId);
      return { ok: true as const };
    });
  }

  @Implement(settingsTestProcedure)
  test(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(settingsTestProcedure).handler(() =>
      this.settings.test(userId),
    );
  }
}
