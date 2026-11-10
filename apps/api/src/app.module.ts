import { LoggerModule } from 'nestjs-pino';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ORPCModule } from '@orpc/nest';
import { AppController } from './app.controller.js';
import { AttemptsController } from './attempts/attempts.controller.js';
import { AttemptsService } from './attempts/attempts.service.js';
import { StaleSweeperService } from './attempts/stale-sweeper.service.js';
import { AudioController } from './audio/audio.controller.js';
import { AudioModule } from './audio/audio.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ExamConfigService } from './config/exam-config.service.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { DatabaseModule } from './database/database.module.js';
import {
  EvaluationService,
  LANGUAGE_MODEL_FACTORY,
  providerModelFactory,
} from './evaluation/evaluation.service.js';
import { ExerciseController } from './exercise/exercise.controller.js';
import { ExerciseService } from './exercise/exercise.service.js';
import { PublicExerciseController } from './exercise/public-exercise.controller.js';
import { loggerParams } from './logging/logger.config.js';
import { MailModule } from './mail/mail.module.js';
import { GeminiLiveProvider } from './providers/gemini-live.provider.js';
import { OpenAiRealtimeProvider } from './providers/openai-realtime.provider.js';
import { VoiceProviderRegistry } from './providers/voice-provider.js';
import { ExamSessionService } from './session/exam-session.service.js';
import { ExamController } from './session/exam.controller.js';
import { ProviderSettingsService } from './settings/provider-settings.service.js';
import { SettingsController } from './settings/settings.controller.js';
import { UsageService } from './usage/usage.service.js';

@Module({
  imports: [
    LoggerModule.forRoot(loggerParams({ NODE_ENV: process.env.NODE_ENV ?? 'development' })),
    ORPCModule.forRoot({}),
    // Per-IP limit on every Nest route (Better Auth applies its own limits under /api/auth).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
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
    ExerciseController,
    PublicExerciseController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
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
      useFactory: (openai: OpenAiRealtimeProvider, gemini: GeminiLiveProvider) =>
        new VoiceProviderRegistry([openai, gemini]),
    },
    StaleSweeperService,
  ],
})
export class AppModule {}
