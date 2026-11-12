import { defineConfig, devices } from '@playwright/test';

/**
 * README images (`pnpm readme:images`, which prepares README_DATABASE_URL): the real API and
 * web app with the fake voice provider, on a throw-away database that holds only the public
 * sample exercise bank, so no third-party subject ends up in a screenshot. Own ports, servers never
 * reused, so it cannot attach to `pnpm dev` or the e2e servers.
 */
export const README_API_URL = 'http://localhost:3201';
export const README_WEB_URL = 'http://localhost:3200';

const databaseUrl = process.env.README_DATABASE_URL;
if (!databaseUrl) throw new Error('README_DATABASE_URL is required: run `pnpm readme:images`.');
const MAILPIT_SMTP_URL = process.env.MAILPIT_SMTP_URL ?? 'smtp://127.0.0.1:1025';

export default defineConfig({
  testDir: './readme',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: README_WEB_URL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    colorScheme: 'light',
    viewport: { width: 1280, height: 800 },
    permissions: ['microphone'],
    reducedMotion: 'reduce',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  webServer: [
    {
      command: 'pnpm --filter @parle-tcf/api... build && node ../api/dist/main.js',
      url: `${README_API_URL}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        PORT: '3201',
        DATABASE_URL: databaseUrl,
        VOICE_PROVIDER: 'fake',
        WEB_URL: README_WEB_URL,
        BETTER_AUTH_URL: README_API_URL,
        CORS_ORIGINS: README_WEB_URL,
        THROTTLE_LIMIT_PER_MINUTE: '100000',
        AUTH_EMAIL_VERIFICATION_ENABLED: 'true',
        SMTP_URL: MAILPIT_SMTP_URL,
        RESEND_API_KEY: '',
      },
    },
    {
      command:
        'pnpm --filter @parle-tcf/web exec next build && pnpm --filter @parle-tcf/web exec next start -p 3200',
      url: README_WEB_URL,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        // Same build directory as the e2e suite (ignored everywhere); every run rebuilds it.
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_EXAM_API_URL: README_API_URL,
        NEXT_PUBLIC_SITE_URL: README_WEB_URL,
        NEXT_PUBLIC_FAKE_VOICE: 'true',
      },
    },
  ],
});
