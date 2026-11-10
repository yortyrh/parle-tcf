import { Global, Module, type Provider } from "@nestjs/common";
import type { Database } from "@parle-tcf/db";
import { AudioService } from "../audio/audio.service.js";
import { DATABASE } from "../database/database.tokens.js";
import { MailService } from "../mail/mail.service.js";
import { BETTER_AUTH, createAuth } from "./better-auth.js";
import { SessionAuthGuard } from "./session-auth.guard.js";
import { OAuthHandoffService } from "./oauth-handoff.service.js";
import { OAuthController } from "./oauth.controller.js";

const betterAuthProvider: Provider = {
  provide: BETTER_AUTH,
  inject: [DATABASE, MailService, AudioService],
  useFactory: (db: Database, mail: MailService, audio: AudioService) =>
    createAuth(db, mail, (userId) => audio.purgeUser(userId)),
};

/** Global so `@UseGuards(SessionAuthGuard)` resolves in every feature module. */
@Global()
@Module({
  providers: [betterAuthProvider, SessionAuthGuard, OAuthHandoffService],
  exports: [BETTER_AUTH, SessionAuthGuard],
  controllers: [OAuthController],
})
export class AuthModule {}
