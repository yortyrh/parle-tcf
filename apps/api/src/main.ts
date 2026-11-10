import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Logger } from 'nestjs-pino';
import { NestFactory } from '@nestjs/core';

const _dir = dirname(fileURLToPath(import.meta.url));
const localEnv = resolve(_dir, '..', '.env');
const rootEnv = resolve(_dir, '..', '..', '..', '.env');
dotenv.config({ path: existsSync(localEnv) ? localEnv : rootEnv });

async function bootstrap(): Promise<void> {
  // Imported after dotenv so module-level env reads see the loaded values.
  const { AppModule } = await import('./app.module.js');
  const { configureApp } = await import('./app-setup.js');
  const { getEnv } = await import('./config/env.js');

  const env = getEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  configureApp(app, env);

  await app.listen(env.PORT);
  app.get(Logger).log(`listening on http://localhost:${env.PORT}`, 'Bootstrap');
}

void bootstrap();
