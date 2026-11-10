#!/usr/bin/env node
/**
 * `pnpm env-schema:check`: fails when a variable of the API env schema
 * (apps/api/src/config/env.ts, read from the build) is not documented in
 * apps/api/.env.example. Runs after `pnpm build`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { missingEnvKeys } from './lib/env-example.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { ENV_KEYS } = await import(pathToFileURL(join(ROOT, 'apps/api/dist/config/env.js')).href);
const example = readFileSync(join(ROOT, 'apps/api/.env.example'), 'utf8');

// NODE_ENV is set by the runtime, not by the operator.
const missing = missingEnvKeys(ENV_KEYS, example, { ignore: ['NODE_ENV'] });
if (missing.length > 0) {
  console.error(
    `env-schema:check: document these variables in apps/api/.env.example:\n  ${missing.join('\n  ')}`
  );
  process.exit(1);
}
console.log(`env-schema:check: ${ENV_KEYS.length} variables documented.`);
