import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import * as prettier from 'prettier';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Guards the separate dev build folder for apps/web:
// `pnpm verify` runs `next build` into apps/web/.next; a running `pnpm dev` used the same folder
// and broke (GET / -> 500, "Could not find the module ..."). The dev server now writes to
// `.next-dev` (unless NEXT_DIST_DIR is set), production keeps `.next`, and `.next-dev` is
// ignored everywhere build output is.

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const readRepoFile = (path) => readFileSync(join(ROOT, path), 'utf8');
const WEB_SCRIPTS = JSON.parse(readRepoFile('apps/web/package.json')).scripts;

const DEV_OUTPUT_FILE = 'apps/web/.next-dev/server/app/page.js';

// Fake `next` binary: prints the arguments and NEXT_DIST_DIR it was started with.
const FAKE_NEXT = `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  args: process.argv.slice(2),
  distDir: process.env.NEXT_DIST_DIR ?? null,
}));
`;

describe('apps/web package scripts', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'web-dev-config-'));
    const bin = join(sandbox, 'bin');
    mkdirSync(bin);
    const fakeNext = join(bin, 'next');
    writeFileSync(fakeNext, FAKE_NEXT);
    chmodSync(fakeNext, 0o755);
  });

  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  // Runs a package script through `sh -c` (as pnpm does) with the fake `next` first on PATH.
  const runScript = (name, extraEnv = {}) => {
    const env = { ...process.env, PATH: `${join(sandbox, 'bin')}${delimiter}${process.env.PATH}` };
    delete env.NEXT_DIST_DIR;
    Object.assign(env, extraEnv);
    const result = spawnSync('sh', ['-c', WEB_SCRIPTS[name]], {
      cwd: sandbox,
      env,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout);
  };

  it('dev starts `next dev --turbopack` writing to .next-dev by default', () => {
    expect(runScript('dev')).toEqual({ args: ['dev', '--turbopack'], distDir: '.next-dev' });
  });

  it('dev keeps an explicitly set NEXT_DIST_DIR', () => {
    expect(runScript('dev', { NEXT_DIST_DIR: '.next-custom' })).toEqual({
      args: ['dev', '--turbopack'],
      distDir: '.next-custom',
    });
  });

  it.each([
    ['build', ['build']],
    ['start', ['start']],
  ])('%s keeps the default .next folder (no NEXT_DIST_DIR forced)', (name, args) => {
    expect(WEB_SCRIPTS[name]).not.toContain('NEXT_DIST_DIR');
    expect(WEB_SCRIPTS[name]).not.toContain('.next-dev');
    expect(runScript(name)).toEqual({ args, distDir: null });
  });
});

describe('.next-dev is ignored like the other build output', () => {
  it('git ignores it', () => {
    const check = (path) =>
      spawnSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: ROOT }).status;
    expect(check('apps/web/.next/server/app/page.js')).toBe(0);
    expect(check(DEV_OUTPUT_FILE)).toBe(0);
    expect(check('apps/web/lib/page.js')).toBe(1);
  });

  it('prettier ignores it', async () => {
    const ignorePath = join(ROOT, '.prettierignore');
    const isIgnored = async (path) =>
      (await prettier.getFileInfo(join(ROOT, path), { ignorePath })).ignored;
    expect(await isIgnored('apps/web/.next/server/app/page.js')).toBe(true);
    expect(await isIgnored(DEV_OUTPUT_FILE)).toBe(true);
    expect(await isIgnored('apps/web/lib/page.js')).toBe(false);
  });

  it('eslint ignores it', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const isIgnored = (path) => eslint.isPathIgnored(join(ROOT, path));
    expect(await isIgnored('apps/web/.next/server/app/page.js')).toBe(true);
    expect(await isIgnored(DEV_OUTPUT_FILE)).toBe(true);
    expect(await isIgnored('apps/web/lib/page.ts')).toBe(false);
  }, 30_000);

  it('the docker build context leaves it out', () => {
    const lines = readRepoFile('.dockerignore')
      .split('\n')
      .map((line) => line.trim());
    expect(lines).toContain('.next');
    expect(lines.some((line) => /^(\*\*\/)?\.next-dev\/?$/.test(line))).toBe(true);
  });
});

describe('apps/web/tsconfig.json', () => {
  // `next dev` adds `<distDir>/types/**/*.ts` to `include` on start when it is missing,
  // which would dirty the tree on every dev run.
  it('includes the generated types of the dev and production builds', () => {
    const { include } = JSON.parse(readRepoFile('apps/web/tsconfig.json'));
    expect(include).toContain('.next/types/**/*.ts');
    expect(include).toContain('.next-dev/types/**/*.ts');
  });
});
