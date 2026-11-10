import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getApiConfigDir } from '../paths.js';

export const RUBRIC_VERSION = 'v1';

let cached: string | undefined;

/** French rubric (criteria + CEFR descriptors) used as the system prompt. */
export function loadRubric(): string {
  cached ??= readFileSync(
    join(getApiConfigDir(), 'français', `rubrique-${RUBRIC_VERSION}.md`),
    'utf8'
  );
  return cached;
}
