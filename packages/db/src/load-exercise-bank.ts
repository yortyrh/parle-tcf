/**
 * `node packages/db/dist/load-exercise-bank.js [--file <bank.sql>] [--force]`
 * (`pnpm exercises:load` at the repository root; the API pre-deploy step after migrations).
 *
 * Loads the exercise bank into an EMPTY bank: from `--file`, else from the private repository
 * (EXERCISE_DATA_TOKEN, optional EXERCISE_DATA_REPO / EXERCISE_DATA_PATH / EXERCISE_DATA_REF).
 * A bank that already has subjects is left alone (no download), and without a source the
 * command only explains how to get one: a deploy never fails because the bank is optional.
 */
import { readFileSync } from 'node:fs';
import { createDb } from './client';
import {
  fetchExerciseBankSql,
  isExerciseBankEmpty,
  loadExerciseBank,
  resolveExerciseBankSource,
} from './exercise-bank-loader';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const file = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
  const force = args.includes('--force');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const handle = createDb({ url, max: 1 });
  try {
    if (!force && !(await isExerciseBankEmpty(handle.db))) {
      console.log('exercises:load: the bank already has subjects, nothing to do.');
      return;
    }
    const source = resolveExerciseBankSource({ file, token: process.env.EXERCISE_DATA_TOKEN });
    if (source.kind === 'none') {
      console.log(
        'exercises:load: no source. Set EXERCISE_DATA_TOKEN (private bank), pass --file ' +
          '(e.g. packages/db/seed/sample-exercise-bank.sql), or run `pnpm exercises:import`.'
      );
      return;
    }
    const text =
      source.kind === 'file'
        ? readFileSync(source.path, 'utf8')
        : await fetchExerciseBankSql({
            token: source.token,
            repo: process.env.EXERCISE_DATA_REPO || undefined,
            path: process.env.EXERCISE_DATA_PATH || undefined,
            ref: process.env.EXERCISE_DATA_REF || undefined,
          });
    const result = await loadExerciseBank(handle.db, text, { force });
    console.log(
      `exercises:load: ${result} (${source.kind === 'file' ? source.path : 'private repository'}).`
    );
  } finally {
    await handle.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
