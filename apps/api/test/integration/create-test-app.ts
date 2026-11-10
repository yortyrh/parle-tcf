import supertest from 'supertest';
import { inject } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Database } from '@parle-tcf/db';

/** URL the auth emails link to (the web app); only used to build links. */
export const TEST_WEB_URL = 'http://web.test';

export interface TestApp {
  app: INestApplication;
  /** Supertest agent bound to the running app. */
  http: () => ReturnType<typeof supertest>;
  db: Database;
  close: () => Promise<void>;
}

/** Environment of the app under test: containers from global-setup, fake providers. */
function applyTestEnv(): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: inject('databaseUrl'),
    SMTP_URL: inject('smtpUrl'),
    RESEND_API_KEY: '',
    MAIL_FROM: 'parle-tcf <no-reply@parle-tcf.test>',
    BETTER_AUTH_URL: 'http://localhost:3001',
    BETTER_AUTH_SECRET: 'integration-secret-integration-secret-0123',
    WEB_URL: TEST_WEB_URL,
    CORS_ORIGINS: '',
    ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 7).toString('base64')}`,
    ENCRYPTION_KEY_CURRENT: 'v1',
    AUTH_EMAIL_VERIFICATION_ENABLED: 'true',
    VOICE_PROVIDER: 'fake',
    THROTTLE_LIMIT_PER_MINUTE: '100000',
    S3_BUCKET: '',
  });
}

/**
 * Boots the real AppModule with the same HTTP setup as main.ts
 * (configureApp), against the Testcontainers Postgres and Mailpit.
 */
export async function createTestApp(): Promise<TestApp> {
  applyTestEnv();
  // Imported after the env is set: modules read it when they load.
  const { resetEnvCache, getEnv } = await import('../../src/config/env.js');
  resetEnvCache();
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app-setup.js');
  const { DATABASE } = await import('../../src/database/database.tokens.js');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, getEnv());
  await app.init();

  return {
    app,
    http: () => supertest(app.getHttpServer()),
    db: app.get<Database>(DATABASE),
    close: () => app.close(),
  };
}
