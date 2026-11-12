#!/usr/bin/env node
/**
 * `pnpm readme:images`: regenerates the README screenshots (docs/images/*.png) and the
 * repository social preview (.github/social-preview.png from .github/social-preview.html).
 *
 * Recreates a throw-away database (`<dev database>_readme`) on the local Postgres with the
 * migrations and only the public sample exercise bank, so no third-party subject from a
 * private bank shows up, then runs apps/e2e/playwright.readme.config.ts (real API and web app
 * with the fake voice provider). Needs `pnpm infra:up` (Postgres + Mailpit).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import {
  SAMPLE_EXERCISE_BANK_PATH,
  createDb,
  loadExerciseBank,
  runMigrations,
} from '@parle-tcf/db';
import { devInfra } from './lib/local-env.mjs';

const infra = devInfra(process.env);
const devUrl = new URL(
  process.env.DATABASE_URL?.trim() ||
    `postgresql://parle:parle@127.0.0.1:${infra.postgresPort}/parle`
);
const devName = devUrl.pathname.slice(1);
const readmeName = `${devName}_readme`;
const readmeUrl = new URL(devUrl);
readmeUrl.pathname = `/${readmeName}`;

const admin = createDb({ url: devUrl.href, max: 1 });
try {
  await admin.pool.query(`DROP DATABASE IF EXISTS "${readmeName}" WITH (FORCE)`);
  await admin.pool.query(`CREATE DATABASE "${readmeName}"`);
} finally {
  await admin.close();
}

await runMigrations(readmeUrl.href);
const handle = createDb({ url: readmeUrl.href, max: 1 });
try {
  const result = await loadExerciseBank(handle.db, readFileSync(SAMPLE_EXERCISE_BANK_PATH, 'utf8'));
  console.log(`readme:images: database ${readmeName} ready, sample bank ${result}.`);
} finally {
  await handle.close();
}

mkdirSync(new URL('../docs/images', import.meta.url), { recursive: true });
const run = spawnSync(
  'pnpm',
  ['--filter', '@parle-tcf/e2e', 'exec', 'playwright', 'test', '-c', 'playwright.readme.config.ts'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      README_DATABASE_URL: readmeUrl.href,
      MAILPIT_URL: `http://localhost:${infra.mailpitUiPort}`,
      MAILPIT_SMTP_URL: `smtp://127.0.0.1:${infra.smtpPort}`,
    },
  }
);
process.exit(run.status ?? 1);
