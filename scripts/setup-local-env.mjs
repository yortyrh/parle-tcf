#!/usr/bin/env node
/**
 * `pnpm setup:env [--dry-run]`: writes apps/api/.env and apps/web/.env.local for
 * local development (logic in scripts/lib/local-env.mjs). Infrastructure keys are
 * rewritten; secrets, auth flags, OAuth credentials and limits are preserved.
 * The previous API env is backed up to apps/api/.env.bak.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  composeApiEnv,
  composeWebEnv,
  devInfra,
  parseDotenv,
  resolveSecrets,
} from './lib/local-env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_ENV = join(ROOT, 'apps/api/.env');
const WEB_ENV = join(ROOT, 'apps/web/.env.local');
const dryRun = process.argv.includes('--dry-run');

const readIfExists = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const previous = parseDotenv(readIfExists(API_ENV));
// Port overrides: the shell wins, then the values stored in apps/api/.env by a previous run.
const PORT_KEYS = ['POSTGRES_PORT', 'MAILPIT_SMTP_PORT', 'MAILPIT_UI_PORT', 'API_PORT', 'WEB_PORT'];
const infra = devInfra({ ...previous, ...process.env });
const portOverrides = PORT_KEYS.filter((key) => (process.env[key] ?? previous[key])?.trim()).map(
  (key) => `${key}=${(process.env[key] ?? previous[key]).trim()}`
);
const { values: secrets, generated } = resolveSecrets(previous);
const apiBody =
  composeApiEnv({ infra, previous, secrets }) +
  (portOverrides.length > 0
    ? `\n# --- Local port overrides (read by scripts/compose.sh) ---\n${portOverrides.join('\n')}\n`
    : '');
const webBody = composeWebEnv({ infra, apiEnv: parseDotenv(apiBody) });

if (dryRun) {
  const redact = (body) =>
    body.replace(
      /^((?:BETTER_AUTH_SECRET|ENCRYPTION_KEYS|\w+_SECRET|\w+_API_KEY)=).+$/gm,
      '$1<redacted>'
    );
  console.log(`# ${API_ENV}\n${redact(apiBody)}\n# ${WEB_ENV}\n${webBody}`);
  process.exit(0);
}

if (existsSync(API_ENV)) copyFileSync(API_ENV, `${API_ENV}.bak`);
writeFileSync(API_ENV, apiBody, { mode: 0o600 });
writeFileSync(WEB_ENV, webBody);

console.log('setup:env: wrote apps/api/.env and apps/web/.env.local');
if (generated.length > 0) console.log(`setup:env: generated ${generated.join(', ')}`);
console.log(
  `setup:env: API http://localhost:${infra.apiPort}, web http://localhost:${infra.webPort}`
);
