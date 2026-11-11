import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Guards the local infra scripts:
// - `pnpm infra:up` must run infra-init with the port overrides saved in apps/api/.env
//   (compose.sh already reads them; infra-init used to migrate against the default port).
// - `pnpm setup:env` backs the API env up to apps/api/.env.bak, which holds secrets and
//   must never be committed.

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
