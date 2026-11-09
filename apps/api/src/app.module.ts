import { Module } from "@nestjs/common";
import { ORPCModule } from "@orpc/nest";
import { AppController } from "./app.controller.js";
import { AttemptsController } from "./attempts/attempts.controller.js";
import { AttemptsService } from "./attempts/attempts.service.js";
import { AuthModule } from "./auth/auth.module.js";
import {
  EvaluationService,
  LANGUAGE_MODEL_FACTORY,
  openAiModelFactory,
} from "./evaluation/evaluation.service.js";
import { UsageService } from "./usage/usage.service.js";
import { ExamConfigService } from "./config/exam-config.service.js";
import { CryptoModule } from "./crypto/crypto.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { ExerciseService } from "./exercise/exercise.service.js";
import { MailModule } from "./mail/mail.module.js";
import { OpenAiRealtimeProvider } from "./providers/openai-realtime.provider.js";
import { VOICE_PROVIDER } from "./providers/voice-provider.js";
import { ExamController } from "./session/exam.controller.js";
import { ExamSessionService } from "./session/exam-session.service.js";
import { ProviderSettingsService } from "./settings/provider-settings.service.js";
import { SettingsController } from "./settings/settings.controller.js";

@Module({
  imports: [
    ORPCModule.forRoot({}),
    DatabaseModule,
    CryptoModule,
    MailModule,
    AuthModule,
  ],
  controllers: [
    AppController,
    ExamController,
    SettingsController,
    AttemptsController,
  ],
  providers: [
    ExamConfigService,
    ExerciseService,
    ExamSessionService,
    ProviderSettingsService,
    AttemptsService,
    EvaluationService,
    UsageService,
    { provide: LANGUAGE_MODEL_FACTORY, useValue: openAiModelFactory },
    { provide: VOICE_PROVIDER, useClass: OpenAiRealtimeProvider },
  ],
})
export class AppModule {}
