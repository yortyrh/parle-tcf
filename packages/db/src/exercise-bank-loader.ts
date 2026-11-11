import path from 'node:path';
import { inArray, sql } from 'drizzle-orm';
import type { Database } from './client';
import { exercises } from './schema';

/**
 * The real exercise bank (subjects published by third parties) lives in a private
 * repository, outside this public one; see docs/adr/0006-private-exercise-bank.md.
 */
export const DEFAULT_EXERCISE_DATA_REPO = 'yortyrh/parle-tcf-data';
export const DEFAULT_EXERCISE_DATA_PATH = 'exercise-bank.sql';

/** Original sample bank shipped with the package (tests, CI, contributors). */
export const SAMPLE_EXERCISE_BANK_PATH = path.resolve(
  __dirname,
  '..',
  'seed',
  'sample-exercise-bank.sql'
);

const BREAKPOINT = /^\s*-->\s*statement-breakpoint\s*$/m;

/** Splits drizzle-style SQL on statement-breakpoint lines; drops empty and comment-only pieces. */
export function splitSqlStatements(text: string): string[] {
  return text
    .split(BREAKPOINT)
    .map((piece) => piece.trim())
    .filter((piece) =>
      piece.split('\n').some((line) => line.trim() !== '' && !line.trim().startsWith('--'))
    );
}

/** True when the bank has no Tâche 2 or 3 subject (the fixed Tâche 1 row does not count). */
export async function isExerciseBankEmpty(db: Database): Promise<boolean> {
  const rows = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(inArray(exercises.task, [2, 3]))
    .limit(1);
  return rows.length === 0;
}

/**
 * Applies a bank in one transaction: all of it or nothing. A bank that already has
 * subjects is left alone unless `force` is set (the SQL itself is idempotent).
 */
export async function loadExerciseBank(
  db: Database,
  text: string,
  opts: { force?: boolean } = {}
): Promise<'loaded' | 'skipped'> {
  if (!opts.force && !(await isExerciseBankEmpty(db))) return 'skipped';
  const statements = splitSqlStatements(text);
  await db.transaction(async (tx) => {
    for (const statement of statements) {
      await tx.execute(sql.raw(statement));
    }
  });
  return 'loaded';
}

/** Downloads the bank from the private repository (GitHub contents API, raw media type). */
export async function fetchExerciseBankSql(opts: {
  token: string;
  repo?: string;
  path?: string;
  ref?: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const repo = opts.repo ?? DEFAULT_EXERCISE_DATA_REPO;
  const file = opts.path ?? DEFAULT_EXERCISE_DATA_PATH;
  const ref = opts.ref ?? 'main';
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(
    `https://api.github.com/repos/${repo}/contents/${file}?ref=${encodeURIComponent(ref)}`,
    {
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: 'application/vnd.github.raw',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  if (!res.ok) {
    // Never echo the token: only the status and what was requested.
    throw new Error(`Could not download ${repo}/${file}: HTTP ${res.status}`);
  }
  return res.text();
}

export type ExerciseBankSource =
  { kind: 'file'; path: string } | { kind: 'repo'; token: string } | { kind: 'none' };

/** A local file wins over the private repository; empty values count as missing. */
export function resolveExerciseBankSource(opts: {
  file?: string;
  token?: string;
}): ExerciseBankSource {
  if (opts.file) return { kind: 'file', path: opts.file };
  if (opts.token) return { kind: 'repo', token: opts.token };
  return { kind: 'none' };
}
