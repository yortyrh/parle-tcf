import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Guards the local infra scripts:
// - `pnpm infra:up` must run infra-init with the port overrides saved in apps/api/.env
//   (compose.sh already reads them; infra-init used to migrate against the default port).
// - `pnpm setup:env` backs the API env up to apps/api/.env.bak, which holds secrets and
//   must never be committed.
// - infra-init fills the exercise bank after migrating: the private bank when
//   EXERCISE_DATA_TOKEN is set, otherwise the public sample bank.

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PACKAGE_JSON = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const INFRA_UP = PACKAGE_JSON.scripts['infra:up'];
const INFRA_UP_STEPS = INFRA_UP.split('&&').map((step) => step.trim());
const INFRA_INIT_STEP = INFRA_UP_STEPS.at(-1);

const PROBED_KEYS = ['POSTGRES_PORT', 'DATABASE_URL'];
const FILE_DATABASE_URL = 'postgres://from-file:secret@127.0.0.1:5433/parle_tcf';

// Prints the probed variables as infra-init would see them.
const PROBE_SCRIPT = `process.stdout.write(JSON.stringify({
  POSTGRES_PORT: process.env.POSTGRES_PORT ?? null,
  DATABASE_URL: process.env.DATABASE_URL ?? null,
}));
`;

describe('infra:up script', () => {
  it('starts compose, then builds the db package, then runs infra-init', () => {
    expect(INFRA_UP_STEPS).toHaveLength(3);
    expect(INFRA_UP_STEPS[0]).toMatch(/^bash scripts\/compose\.sh up -d --wait$/);
    expect(INFRA_UP_STEPS[1]).toBe('pnpm --filter @parle-tcf/db build');
    expect(INFRA_INIT_STEP).toMatch(/^node\s.*scripts\/infra-init\.mjs$/);
  });

  it('runs infra-init with node, targeting scripts/infra-init.mjs as the last argument', () => {
    const tokens = INFRA_INIT_STEP.split(/\s+/);
    expect(tokens[0]).toBe('node');
    expect(tokens.at(-1)).toBe('scripts/infra-init.mjs');
  });

  // Runs the exact infra-init step of `infra:up` in a temp dir that mimics the repo layout,
  // with a probe in place of scripts/infra-init.mjs.
  describe('infra-init environment', () => {
    let repo;

    beforeEach(() => {
      repo = mkdtempSync(join(tmpdir(), 'infra-up-'));
      mkdirSync(join(repo, 'scripts'), { recursive: true });
      writeFileSync(join(repo, 'scripts', 'infra-init.mjs'), PROBE_SCRIPT);
    });

    afterEach(() => {
      rmSync(repo, { recursive: true, force: true });
    });

    const writeApiEnv = (content) => {
      mkdirSync(join(repo, 'apps', 'api'), { recursive: true });
      writeFileSync(join(repo, 'apps', 'api', '.env'), content);
    };

    const runInfraInitStep = (extraEnv = {}) => {
      const env = { ...process.env };
      for (const key of PROBED_KEYS) delete env[key];
      Object.assign(env, extraEnv);
      const result = spawnSync('sh', ['-c', INFRA_INIT_STEP], { cwd: repo, env, encoding: 'utf8' });
      return {
        status: result.status,
        stderr: result.stderr,
        seen: result.status === 0 ? JSON.parse(result.stdout) : null,
      };
    };

    it('loads the port overrides and DATABASE_URL saved in apps/api/.env', () => {
      writeApiEnv(`POSTGRES_PORT=5433\nDATABASE_URL=${FILE_DATABASE_URL}\n`);

      const { status, stderr, seen } = runInfraInitStep();

      expect(status, stderr).toBe(0);
      expect(seen).toEqual({ POSTGRES_PORT: '5433', DATABASE_URL: FILE_DATABASE_URL });
    });

    it('lets the shell environment win over apps/api/.env (same precedence as compose.sh)', () => {
      writeApiEnv(`POSTGRES_PORT=5433\nDATABASE_URL=${FILE_DATABASE_URL}\n`);

      const { status, stderr, seen } = runInfraInitStep({ POSTGRES_PORT: '6543' });

      expect(status, stderr).toBe(0);
      expect(seen.POSTGRES_PORT).toBe('6543');
      // Variables not set in the shell still come from the file.
      expect(seen.DATABASE_URL).toBe(FILE_DATABASE_URL);
    });

    it('still runs when apps/api/.env does not exist', () => {
      const { status, stderr, seen } = runInfraInitStep();

      // Node may print a "not found, continuing" notice on stderr; only the exit status matters.
      expect(status, stderr).toBe(0);
      expect(seen).toEqual({ POSTGRES_PORT: null, DATABASE_URL: null });
    });
  });
});

// Runs the real scripts/infra-init.mjs with @parle-tcf/db and the S3 client swapped for
// recording stubs (module resolve hook), so no database or storage is needed.
describe('infra-init exercise bank', () => {
  const TOKEN = 'ghp_privateDataToken0123456789';
  const DATABASE_URL = 'postgresql://parle:secret@127.0.0.1:5999/parle';
  let dir;
  let callsFile;
  let samplePath;
  let registerPath;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'infra-init-bank-'));
    callsFile = join(dir, 'calls.jsonl');
    samplePath = join(dir, 'sample-exercise-bank.sql');
    writeFileSync(samplePath, 'SAMPLE SQL');
    const realDb = pathToFileURL(join(ROOT, 'packages', 'db', 'dist', 'index.js')).href;
    const dbStub = join(dir, 'db-stub.mjs');
    const s3Stub = join(dir, 's3-stub.mjs');
    const hooks = join(dir, 'hooks.mjs');
    registerPath = join(dir, 'register.mjs');
    const log = `const log = (call, args = []) => appendFileSync(process.env.INFRA_INIT_CALLS, JSON.stringify({ call, args }) + '\\n');`;
    writeFileSync(
      dbStub,
      `import { appendFileSync } from 'node:fs';
export * from ${JSON.stringify(realDb)};
${log}
export const SAMPLE_EXERCISE_BANK_PATH = process.env.STUB_SAMPLE_PATH;
export async function runMigrations(url) { log('runMigrations', [url]); }
export function createDb(opts) {
  log('createDb', [opts]);
  return { db: { stub: 'db' }, pool: {}, close: async () => log('close') };
}
export async function fetchExerciseBankSql(opts) {
  log('fetchExerciseBankSql', [{ token: opts.token, repo: opts.repo ?? null, path: opts.path ?? null }]);
  if (process.env.STUB_FETCH_FAIL) {
    throw new Error('GitHub answered 404 for yortyrh/parle-tcf-data/exercise-bank.sql');
  }
  return 'PRIVATE SQL';
}
export async function loadExerciseBank(db, sql, opts) {
  log('loadExerciseBank', [db, sql, opts ?? null]);
  return process.env.STUB_LOAD_RESULT || 'loaded';
}
`
    );
    writeFileSync(
      s3Stub,
      `import { appendFileSync } from 'node:fs';
${log}
class Command { constructor(input) { this.input = input; } }
export class HeadBucketCommand extends Command {}
export class CreateBucketCommand extends Command {}
export class PutBucketCorsCommand extends Command {}
export class S3Client {
  async send(command) { log('s3', [command.constructor.name]); return {}; }
}
`
    );
    writeFileSync(
      hooks,
      `const STUBS = {
  '@parle-tcf/db': ${JSON.stringify(pathToFileURL(dbStub).href)},
  '@aws-sdk/client-s3': ${JSON.stringify(pathToFileURL(s3Stub).href)},
};
export async function resolve(specifier, context, next) {
  if (specifier in STUBS) return { url: STUBS[specifier], shortCircuit: true };
  return next(specifier, context);
}
`
    );
    writeFileSync(
      registerPath,
      `import { register } from 'node:module';\nregister(${JSON.stringify(pathToFileURL(hooks).href)});\n`
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const runInfraInit = (extraEnv = {}) => {
    const env = { ...process.env };
    delete env.EXERCISE_DATA_TOKEN;
    Object.assign(env, {
      DATABASE_URL,
      INFRA_INIT_CALLS: callsFile,
      STUB_SAMPLE_PATH: samplePath,
      ...extraEnv,
    });
    const result = spawnSync(
      process.execPath,
      ['--import', pathToFileURL(registerPath).href, join(ROOT, 'scripts', 'infra-init.mjs')],
      { cwd: ROOT, env, encoding: 'utf8', timeout: 60_000 }
    );
    let calls = [];
    try {
      calls = readFileSync(callsFile, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch {
      // No call recorded.
    }
    return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls };
  };

  const names = (calls) => calls.map((c) => c.call);
  const callOf = (calls, name) => calls.find((c) => c.call === name);

  it('loads the sample bank after the migrations when no token is set', () => {
    const { status, stderr, calls } = runInfraInit();

    expect(status, stderr).toBe(0);
    const order = names(calls);
    expect(order.indexOf('runMigrations')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('loadExerciseBank')).toBeGreaterThan(order.indexOf('runMigrations'));
    expect(order).not.toContain('fetchExerciseBankSql');
    expect(callOf(calls, 'runMigrations').args).toEqual([DATABASE_URL]);
    expect(callOf(calls, 'createDb').args[0]).toMatchObject({ url: DATABASE_URL });

    const load = callOf(calls, 'loadExerciseBank');
    expect(load.args[0]).toEqual({ stub: 'db' });
    expect(load.args[1]).toBe('SAMPLE SQL');
    // Only an empty bank is filled: never forced.
    expect(load.args[2]?.force ?? false).toBe(false);
    expect(order.filter((n) => n === 'loadExerciseBank')).toHaveLength(1);
    // The connection opened for the bank is closed.
    expect(order.indexOf('close')).toBeGreaterThan(order.indexOf('loadExerciseBank'));
  });

  it('treats an empty EXERCISE_DATA_TOKEN like no token', () => {
    const { status, stderr, calls } = runInfraInit({ EXERCISE_DATA_TOKEN: '' });

    expect(status, stderr).toBe(0);
    expect(names(calls)).not.toContain('fetchExerciseBankSql');
    expect(callOf(calls, 'loadExerciseBank').args[1]).toBe('SAMPLE SQL');
  });

  it('loads the private bank with EXERCISE_DATA_TOKEN, without leaking the token', () => {
    const { status, stdout, stderr, calls } = runInfraInit({ EXERCISE_DATA_TOKEN: TOKEN });

    expect(status, stderr).toBe(0);
    const order = names(calls);
    const fetch = callOf(calls, 'fetchExerciseBankSql');
    expect(fetch.args[0].token).toBe(TOKEN);
    // The default repository and file of the package.
    expect(fetch.args[0].repo ?? 'yortyrh/parle-tcf-data').toBe('yortyrh/parle-tcf-data');
    expect(fetch.args[0].path ?? 'exercise-bank.sql').toBe('exercise-bank.sql');
    expect(order.indexOf('fetchExerciseBankSql')).toBeGreaterThan(order.indexOf('runMigrations'));
    expect(callOf(calls, 'loadExerciseBank').args[1]).toBe('PRIVATE SQL');
    expect(stdout + stderr).not.toContain(TOKEN);
  });

  it('leaves an already filled bank alone and still succeeds', () => {
    const { status, stderr, calls } = runInfraInit({ STUB_LOAD_RESULT: 'skipped' });

    expect(status, stderr).toBe(0);
    expect(names(calls).filter((n) => n === 'loadExerciseBank')).toHaveLength(1);
    expect(names(calls)).toContain('s3');
  });

  it('fails when the private bank cannot be downloaded, without leaking the token', () => {
    const { status, stdout, stderr, calls } = runInfraInit({
      EXERCISE_DATA_TOKEN: TOKEN,
      STUB_FETCH_FAIL: '1',
    });

    expect(status).not.toBe(0);
    expect(names(calls)).not.toContain('loadExerciseBank');
    expect(stderr).toContain('404');
    expect(stdout + stderr).not.toContain(TOKEN);
  });
});

describe('.gitignore', () => {
  // --no-index checks the ignore rules themselves, also for tracked or missing paths.
  const isIgnored = (path) =>
    spawnSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: ROOT }).status;

  it.each(['apps/api/.env.bak', '.env.bak', 'apps/web/.env.bak', 'packages/db/.env.bak'])(
    'ignores the env backup %s',
    (path) => {
      expect(isIgnored(path)).toBe(0);
    }
  );

  it.each(['.env.example', 'apps/api/.env.example', 'apps/web/.env.example'])(
    'keeps the tracked example %s out of the ignore rules',
    (path) => {
      expect(isIgnored(path)).toBe(1);
    }
  );

  it('still ignores the real env files', () => {
    expect(isIgnored('apps/api/.env')).toBe(0);
    expect(isIgnored('apps/web/.env.local')).toBe(0);
  });
});
