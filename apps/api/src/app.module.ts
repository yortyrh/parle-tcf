import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { ORPCModule } from "@orpc/nest";
import { AppController } from "./app.controller.js";
import { AttemptsController } from "./attempts/attempts.controller.js";
import { AttemptsService } from "./attempts/attempts.service.js";
import { AudioController } from "./audio/audio.controller.js";
import { AudioModule } from "./audio/audio.module.js";
import { AuthModule } from "./auth/auth.module.js";
import {
  EvaluationService,
  LANGUAGE_MODEL_FACTORY,
  providerModelFactory,
} from "./evaluation/evaluation.service.js";
import { UsageService } from "./usage/usage.service.js";
import { ExamConfigService } from "./config/exam-config.service.js";
import { CryptoModule } from "./crypto/crypto.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { ExerciseService } from "./exercise/exercise.service.js";
import { loggerParams } from "./logging/logger.config.js";
import { MailModule } from "./mail/mail.module.js";
import { GeminiLiveProvider } from "./providers/gemini-live.provider.js";
import { OpenAiRealtimeProvider } from "./providers/openai-realtime.provider.js";
import { VoiceProviderRegistry } from "./providers/voice-provider.js";
import { ExamController } from "./session/exam.controller.js";
import { ExamSessionService } from "./session/exam-session.service.js";
import { ProviderSettingsService } from "./settings/provider-settings.service.js";
import { SettingsController } from "./settings/settings.controller.js";

@Module({
  imports: [
    LoggerModule.forRoot(
      loggerParams({ NODE_ENV: process.env.NODE_ENV ?? "development" }),
    ),
    ORPCModule.forRoot({}),
    DatabaseModule,
    CryptoModule,
    MailModule,
    AudioModule,
    AuthModule,
  ],
  controllers: [
    AppController,
    ExamController,
    SettingsController,
    AttemptsController,
    AudioController,
  ],
  providers: [
    ExamConfigService,
    ExerciseService,
    ExamSessionService,
    ProviderSettingsService,
    AttemptsService,
    EvaluationService,
    UsageService,
    { provide: LANGUAGE_MODEL_FACTORY, useValue: providerModelFactory },
    OpenAiRealtimeProvider,
    GeminiLiveProvider,
    {
      provide: VoiceProviderRegistry,
      inject: [OpenAiRealtimeProvider, GeminiLiveProvider],
      useFactory: (
        openai: OpenAiRealtimeProvider,
        gemini: GeminiLiveProvider,
      ) => new VoiceProviderRegistry([openai, gemini]),
    },
  ],
})
export class AppModule {}
