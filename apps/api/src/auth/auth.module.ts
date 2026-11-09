import { Global, Module, type Provider } from "@nestjs/common";
import type { Database } from "@parle-tcf/db";
import { DATABASE } from "../database/database.tokens.js";
import { MailService } from "../mail/mail.service.js";
import { BETTER_AUTH, createAuth } from "./better-auth.js";
import { SessionAuthGuard } from "./session-auth.guard.js";

const betterAuthProvider: Provider = {
  provide: BETTER_AUTH,
  inject: [DATABASE, MailService],
  useFactory: (db: Database, mail: MailService) => createAuth(db, mail),
};

/** Global so `@UseGuards(SessionAuthGuard)` resolves in every feature module. */
@Global()
@Module({
  providers: [betterAuthProvider, SessionAuthGuard],
  exports: [BETTER_AUTH, SessionAuthGuard],
})
export class AuthModule {}
