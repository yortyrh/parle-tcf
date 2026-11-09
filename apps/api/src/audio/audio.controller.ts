import { Controller, Req, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { currentUserId } from "../auth/current-user.js";
import {
  type AuthenticatedRequest,
  SessionAuthGuard,
} from "../auth/session-auth.guard.js";
import {
  audioDownloadUrlProcedure,
  audioSetConsentProcedure,
  audioStatusProcedure,
  audioUploadUrlProcedure,
} from "../contract/exam.contract.js";
import { AudioService } from "./audio.service.js";

@Controller()
@UseGuards(SessionAuthGuard)
export class AudioController {
  constructor(private readonly audio: AudioService) {}

  @Implement(audioStatusProcedure)
  status(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(audioStatusProcedure).handler(() =>
      this.audio.status(userId),
    );
  }

  @Implement(audioSetConsentProcedure)
  setConsent(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(audioSetConsentProcedure).handler(({ input }) =>
      this.audio.setConsent(userId, input.consent),
    );
  }

  @Implement(audioUploadUrlProcedure)
  uploadUrl(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(audioUploadUrlProcedure).handler(({ input }) =>
      this.audio.uploadUrl(userId, input),
    );
  }

  @Implement(audioDownloadUrlProcedure)
  downloadUrl(@Req() req: AuthenticatedRequest) {
    const userId = currentUserId(req);
    return implement(audioDownloadUrlProcedure).handler(({ input }) =>
      this.audio.downloadUrl(userId, input.attemptId),
    );
  }
}
