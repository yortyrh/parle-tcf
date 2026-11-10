import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Root of `apps/api` (works in dev and after `nest build` into `dist/`). */
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function getApiConfigDir(): string {
  return join(apiRoot, 'config');
}
