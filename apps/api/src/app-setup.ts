import { toNodeHandler } from 'better-auth/node';
import type { Express } from 'express';
import helmet from 'helmet';
import type { INestApplication } from '@nestjs/common';
import { AUTH_BASE_PATH, type Auth, BETTER_AUTH } from './auth/better-auth.js';
import { type Env, parseCorsOrigins } from './config/env.js';

/**
 * HTTP setup shared by main.ts and the integration tests: security headers,
 * CORS for the web app, and Better Auth mounted before Nest's body parsers.
 */
export function configureApp(app: INestApplication, env: Env): void {
  // JSON API only: helmet's defaults (no sniffing, no framing, strict CSP) are safe here.
  app.use(helmet());
  app.enableCors({
    origin: parseCorsOrigins(env),
    credentials: true,
    exposedHeaders: ['set-auth-token'],
  });
  // Better Auth parses its own body, so it is mounted before Nest's parsers.
  const server = app.getHttpAdapter().getInstance() as Express;
  server.all(`${AUTH_BASE_PATH}/*splat`, toNodeHandler(app.get<Auth>(BETTER_AUTH)));
}
