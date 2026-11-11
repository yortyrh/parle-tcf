import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { count } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from './client';
import { TACHE1_ENTRETIEN_ID, contentHash, parseSourceRef } from './exercise-bank';
import {
  DEFAULT_EXERCISE_DATA_PATH,
  DEFAULT_EXERCISE_DATA_REPO,
  SAMPLE_EXERCISE_BANK_PATH,
  fetchExerciseBankSql,
  isExerciseBankEmpty,
  loadExerciseBank,
  resolveExerciseBankSource,
  splitSqlStatements,
} from './exercise-bank-loader';
import * as dbIndex from './index';
import { exerciseAliases, exerciseOccurrences, exerciseSessions, exercises } from './schema';
import { type TestDb, createTestDb } from './testing';

const PACKAGE_DIR = path.resolve(__dirname, '..');
const BREAKPOINT = '--> statement-breakpoint';
const BANK_ID = /^\d{4}-\d{2}-t[23]-p\d{3}-s\d{3}$/;

async function countOf(
  db: Database,
  table: typeof exercises | typeof exerciseOccurrences | typeof exerciseSessions
): Promise<number> {
  const [row] = await db.select({ n: count() }).from(table);
  return row.n;
}

/** Everything the bank is made of, to compare two states. */
async function snapshot(db: Database) {
  return {
    exercises: await db.select().from(exercises).orderBy(exercises.id),
    occurrences: await db.select().from(exerciseOccurrences).orderBy(exerciseOccurrences.sourceRef),
    sessions: (await db.select().from(exerciseSessions).orderBy(exerciseSessions.id)).map(
      ({ year, month, sourceUrl }) => ({ year, month, sourceUrl })
    ),
    aliases: await db.select().from(exerciseAliases).orderBy(exerciseAliases.aliasId),
  };
}

describe('constants', () => {
  it('points at the private data repository by default', () => {
    expect(DEFAULT_EXERCISE_DATA_REPO).toBe('yortyrh/parle-tcf-data');
    expect(DEFAULT_EXERCISE_DATA_PATH).toBe('exercise-bank.sql');
  });

  it('locates the sample bank shipped with the package', () => {
    expect(path.isAbsolute(SAMPLE_EXERCISE_BANK_PATH)).toBe(true);
    expect(SAMPLE_EXERCISE_BANK_PATH).toBe(
      path.join(PACKAGE_DIR, 'seed', 'sample-exercise-bank.sql')
    );
    expect(existsSync(SAMPLE_EXERCISE_BANK_PATH)).toBe(true);
  });

  it('is exported from the package entry point', () => {
    expect(dbIndex.DEFAULT_EXERCISE_DATA_REPO).toBe(DEFAULT_EXERCISE_DATA_REPO);
    expect(dbIndex.DEFAULT_EXERCISE_DATA_PATH).toBe(DEFAULT_EXERCISE_DATA_PATH);
    expect(dbIndex.SAMPLE_EXERCISE_BANK_PATH).toBe(SAMPLE_EXERCISE_BANK_PATH);
    expect(dbIndex.splitSqlStatements).toBe(splitSqlStatements);
    expect(dbIndex.isExerciseBankEmpty).toBe(isExerciseBankEmpty);
    expect(dbIndex.loadExerciseBank).toBe(loadExerciseBank);
    expect(dbIndex.fetchExerciseBankSql).toBe(fetchExerciseBankSql);
    expect(dbIndex.resolveExerciseBankSource).toBe(resolveExerciseBankSource);
  });
});

describe('splitSqlStatements', () => {
  it('splits on statement-breakpoint lines and trims each statement', () => {
    const sql = [
      '  INSERT INTO a VALUES (1);  ',
      BREAKPOINT,
      'UPDATE a SET x = 2;',
      BREAKPOINT,
      '\nDELETE FROM a;\n',
    ].join('\n');
    expect(splitSqlStatements(sql)).toEqual([
      'INSERT INTO a VALUES (1);',
      'UPDATE a SET x = 2;',
      'DELETE FROM a;',
    ]);
  });

  it('keeps a multi-line statement whole', () => {
    const statement = 'INSERT INTO a (x) VALUES\n(1),\n(2)\nON CONFLICT DO NOTHING;';
    expect(splitSqlStatements(`${statement}\n${BREAKPOINT}\nSELECT 1;`)).toEqual([
      statement,
      'SELECT 1;',
    ]);
  });

  it('drops empty pieces and pieces made only of comment lines', () => {
    const sql = [
      '-- Generated file. Do not edit.',
      '-- Second comment line.',
      BREAKPOINT,
      'SELECT 1;',
      BREAKPOINT,
      '   ',
      BREAKPOINT,
      BREAKPOINT,
      '-- trailing comment',
      '',
    ].join('\n');
    expect(splitSqlStatements(sql)).toEqual(['SELECT 1;']);
  });

  it('keeps a statement that is preceded by a comment', () => {
    const piece = '-- Generated file.\nINSERT INTO a VALUES (1);';
    expect(splitSqlStatements(`${piece}\n${BREAKPOINT}\nSELECT 1;`)).toEqual([piece, 'SELECT 1;']);
  });

  it('returns nothing for an empty or comment-only file', () => {
    expect(splitSqlStatements('')).toEqual([]);
    expect(splitSqlStatements('\n  \n')).toEqual([]);
    expect(splitSqlStatements('-- nothing here\n')).toEqual([]);
  });

  it('returns a single statement when there is no breakpoint', () => {
    expect(splitSqlStatements('SELECT 1;\n')).toEqual(['SELECT 1;']);
  });

  it('splits the sample bank into several statements, none of them a bare comment', () => {
    const statements = splitSqlStatements(readFileSync(SAMPLE_EXERCISE_BANK_PATH, 'utf8'));
    expect(statements.length).toBeGreaterThan(1);
    for (const s of statements) {
      expect(s).toBe(s.trim());
      expect(s).not.toContain(BREAKPOINT);
      expect(s.split('\n').every((line) => line.trim().startsWith('--'))).toBe(false);
    }
  });
});

describe('with a freshly migrated database', () => {
  let sampleSql: string;
  let testDb: TestDb;
  let db: Database;

  beforeAll(() => {
    sampleSql = readFileSync(SAMPLE_EXERCISE_BANK_PATH, 'utf8');
  });
  beforeEach(async () => {
    testDb = await createTestDb();
    db = testDb.db;
  });
  afterEach(async () => {
    await testDb.close();
  });

  describe('isExerciseBankEmpty', () => {
    it('is true after the migrations alone (the tâche 1 row does not count)', async () => {
      expect(await db.select().from(exercises)).toEqual([
        expect.objectContaining({ id: TACHE1_ENTRETIEN_ID, task: 1 }),
      ]);
      expect(await isExerciseBankEmpty(db)).toBe(true);
    });

    it('stays true with other tâche 1 rows only', async () => {
      await db
        .insert(exercises)
        .values({ id: 't1-autre', task: 1, prompt: 'Autre', contentHash: contentHash('Autre') });
      expect(await isExerciseBankEmpty(db)).toBe(true);
    });

    it.each([2, 3])('is false as soon as there is one tâche %i subject', async (task) => {
      await db.insert(exercises).values({
        id: `x-t${task}`,
        task,
        prompt: 'Sujet',
        contentHash: contentHash('Sujet'),
      });
      expect(await isExerciseBankEmpty(db)).toBe(false);
    });

    it('is false once the sample bank is loaded', async () => {
      await loadExerciseBank(db, sampleSql);
      expect(await isExerciseBankEmpty(db)).toBe(false);
    });
  });

  describe('loadExerciseBank', () => {
    it('loads the sample bank into an empty bank', async () => {
      expect(await loadExerciseBank(db, sampleSql)).toBe('loaded');

      const all = await db.select().from(exercises);
      const t2 = all.filter((e) => e.task === 2);
      const t3 = all.filter((e) => e.task === 3);
      expect(t2.length).toBeGreaterThanOrEqual(21);
      expect(t3.length).toBeGreaterThanOrEqual(5);
      expect(all.filter((e) => e.task === 1).map((e) => e.id)).toEqual([TACHE1_ENTRETIEN_ID]);
      expect(t2.some((e) => /\blogement\b/i.test(e.prompt))).toBe(true);
    });

    it('gives the sample bank the shape of the real one', async () => {
      await loadExerciseBank(db, sampleSql);
      const { exercises: all, occurrences, sessions, aliases } = await snapshot(db);
      const subjects = all.filter((e) => e.task === 2 || e.task === 3);

      // Two monthly sessions, both used.
      expect(sessions).toHaveLength(2);
      const sessionRows = await db.select().from(exerciseSessions);
      const used = new Set(occurrences.map((o) => o.sessionId));
      for (const s of sessionRows) expect(used.has(s.id)).toBe(true);

      // No aliases: one occurrence per subject.
      expect(aliases).toEqual([]);
      expect(occurrences).toHaveLength(subjects.length);
      expect(new Set(occurrences.map((o) => o.exerciseId))).toEqual(
        new Set(subjects.map((e) => e.id))
      );

      const months = new Set(
        sessionRows.map((s) => `${s.year}-${String(s.month).padStart(2, '0')}`)
      );
      for (const e of subjects) {
        expect(e.id, e.id).toMatch(BANK_ID);
        const ref = parseSourceRef(e.id);
        expect(ref?.task, e.id).toBe(e.task);
        expect(months.has(e.id.slice(0, 7)), e.id).toBe(true);
      }
      for (const e of all) expect(e.contentHash, e.id).toBe(contentHash(e.prompt));
      // Distinct subjects: no two share a hash within a task.
      const keys = subjects.map((e) => `${e.task}:${e.contentHash}`);
      expect(new Set(keys).size).toBe(subjects.length);
    });

    it('skips a bank that is already loaded, without running anything', async () => {
      await loadExerciseBank(db, sampleSql);
      const before = await snapshot(db);

      const destructive = [
        'DELETE FROM "exercise_occurrences";',
        BREAKPOINT,
        `DELETE FROM "exercises" WHERE "task" IN (2, 3);`,
      ].join('\n');
      expect(await loadExerciseBank(db, destructive)).toBe('skipped');
      expect(await loadExerciseBank(db, destructive, { force: false })).toBe('skipped');

      expect(await snapshot(db)).toEqual(before);
    });

    it('runs the statements anyway with force', async () => {
      await loadExerciseBank(db, sampleSql);
      const sql = `DELETE FROM "exercise_occurrences";\n${BREAKPOINT}\nDELETE FROM "exercises" WHERE "task" IN (2, 3);`;

      expect(await loadExerciseBank(db, sql, { force: true })).toBe('loaded');

      expect(await countOf(db, exerciseOccurrences)).toBe(0);
      expect(await isExerciseBankEmpty(db)).toBe(true);
    });

    it('loading the same bank twice with force leaves the same data', async () => {
      expect(await loadExerciseBank(db, sampleSql)).toBe('loaded');
      const first = await snapshot(db);

      expect(await loadExerciseBank(db, sampleSql, { force: true })).toBe('loaded');

      expect(await snapshot(db)).toEqual(first);
    });

    it('keeps nothing when a statement fails, and rethrows the error', async () => {
      const broken = `${sampleSql}\n${BREAKPOINT}\nINSERT INTO "no_such_table" VALUES (1);`;

      await expect(loadExerciseBank(db, broken)).rejects.toThrow(/no_such_table/);

      expect(await isExerciseBankEmpty(db)).toBe(true);
      expect(await countOf(db, exerciseSessions)).toBe(0);
      expect(await countOf(db, exerciseOccurrences)).toBe(0);
      expect(await countOf(db, exercises)).toBe(1);
    });

    it('rolls back the statements before a failing one in the middle', async () => {
      const [first, ...rest] = splitSqlStatements(sampleSql);
      const broken = [first, 'SELECT 1 / 0;', ...rest].join(`\n${BREAKPOINT}\n`);

      await expect(loadExerciseBank(db, broken)).rejects.toThrow();

      expect(await countOf(db, exerciseSessions)).toBe(0);
      expect(await isExerciseBankEmpty(db)).toBe(true);
    });

    it('rolls back a forced reload that fails, keeping the loaded bank', async () => {
      await loadExerciseBank(db, sampleSql);
      const before = await snapshot(db);
      const broken = `DELETE FROM "exercise_occurrences";\n${BREAKPOINT}\nSELECT 1 / 0;`;

      await expect(loadExerciseBank(db, broken, { force: true })).rejects.toThrow();

      expect(await snapshot(db)).toEqual(before);
    });
  });
});

describe('fetchExerciseBankSql', () => {
  const TOKEN = 'ghp_secretTokenValue0123456789';

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function okFetch(body = 'SELECT 1;') {
    return vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(new Response(body, { status: 200 }))
    );
  }

  const headersOf = (init?: RequestInit) => new Headers(init?.headers);

  it('downloads the raw file of the default repository on main', async () => {
    const fetchImpl = okFetch('INSERT INTO x VALUES (1);');

    const sql = await fetchExerciseBankSql({ token: TOKEN, fetchImpl });

    expect(sql).toBe('INSERT INTO x VALUES (1);');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      'https://api.github.com/repos/yortyrh/parle-tcf-data/contents/exercise-bank.sql?ref=main'
    );
    expect((init?.method ?? 'GET').toUpperCase()).toBe('GET');
    const headers = headersOf(init);
    expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(headers.get('accept')).toBe('application/vnd.github.raw');
    expect(headers.get('x-github-api-version')).toBe('2022-11-28');
  });

  it('uses the given repository, path and ref', async () => {
    const fetchImpl = okFetch();
    await fetchExerciseBankSql({
      token: TOKEN,
      repo: 'someone/other-data',
      path: 'banks/v2.sql',
      ref: 'release',
      fetchImpl,
    });
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      'https://api.github.com/repos/someone/other-data/contents/banks/v2.sql?ref=release'
    );
  });

  it('uses the global fetch when none is given', async () => {
    const globalFetch = okFetch('SELECT 2;');
    vi.stubGlobal('fetch', globalFetch);
    expect(await fetchExerciseBankSql({ token: TOKEN })).toBe('SELECT 2;');
    expect(globalFetch).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 404, 500])(
    'throws on HTTP %i with the status and the file, never the token',
    async (status) => {
      const fetchImpl = vi.fn(() =>
        Promise.resolve(new Response('{"message":"Bad credentials"}', { status }))
      );

      const error = await fetchExerciseBankSql({ token: TOKEN, fetchImpl }).then(
        () => null,
        (e: unknown) => e
      );

      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain(String(status));
      expect(message).toContain('yortyrh/parle-tcf-data/exercise-bank.sql');
      expect(message).not.toContain(TOKEN);
    }
  );

  it('names the requested file in the error', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('', { status: 404 })));
    await expect(
      fetchExerciseBankSql({ token: TOKEN, repo: 'a/b', path: 'c.sql', fetchImpl })
    ).rejects.toThrow('a/b/c.sql');
  });
});

describe('resolveExerciseBankSource', () => {
  it.each([
    ['nothing', {}, { kind: 'none' }],
    ['empty strings', { file: '', token: '' }, { kind: 'none' }],
    ['a token', { token: 'tok' }, { kind: 'repo', token: 'tok' }],
    ['a token and an empty file', { file: '', token: 'tok' }, { kind: 'repo', token: 'tok' }],
    ['a file', { file: 'bank.sql' }, { kind: 'file', path: 'bank.sql' }],
    [
      'a file and an empty token',
      { file: 'bank.sql', token: '' },
      { kind: 'file', path: 'bank.sql' },
    ],
    [
      'a file and a token (file wins)',
      { file: 'bank.sql', token: 'tok' },
      { kind: 'file', path: 'bank.sql' },
    ],
  ] as const)('with %s', (_label, input, expected) => {
    expect(resolveExerciseBankSource(input)).toEqual(expected);
  });
});
