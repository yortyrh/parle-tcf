import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite: real API and web app (fake voice provider), against the
 * local infra (`pnpm infra:up`: Postgres + Mailpit from docker-compose.dev.yml).
 * Ports differ from `pnpm dev` so both can run at once.
 */
export const API_URL = 'http://localhost:3101';
export const WEB_URL = 'http://localhost:3100';
/** Mailpit of the local infra; override both when its ports differ (MAILPIT_*_PORT). */
export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const MAILPIT_SMTP_URL = process.env.MAILPIT_SMTP_URL ?? 'smtp://127.0.0.1:1025';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      // The API reads apps/api/.env (database, secrets); these overrides win.
      command: 'pnpm --filter @parle-tcf/api... build && node ../api/dist/main.js',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        PORT: '3101',
        VOICE_PROVIDER: 'fake',
        WEB_URL,
        BETTER_AUTH_URL: API_URL,
        CORS_ORIGINS: WEB_URL,
        THROTTLE_LIMIT_PER_MINUTE: '100000',
        AUTH_EMAIL_VERIFICATION_ENABLED: 'true',
        SMTP_URL: MAILPIT_SMTP_URL,
        RESEND_API_KEY: '',
      },
    },
    {
      command:
        'pnpm --filter @parle-tcf/web exec next build && pnpm --filter @parle-tcf/web exec next start -p 3100',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_EXAM_API_URL: API_URL,
        NEXT_PUBLIC_SITE_URL: WEB_URL,
        NEXT_PUBLIC_FAKE_VOICE: 'true',
      },
    },
  ],
});
