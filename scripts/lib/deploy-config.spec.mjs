import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Guards the deploy configuration files against the regressions that broke a Railway deploy:
// skipped builds (watchPatterns), a build-arg overridden to Node 22, and `prepare` failing
// inside Docker images that have no `.git` and no `git` binary.

const ROOT = new URL('../../', import.meta.url);
const readRepoFile = (path) => readFileSync(new URL(path, ROOT), 'utf8');

const SERVICES = ['api', 'web'];
const DOCKERFILES = ['apps/api/Dockerfile', 'apps/web/Dockerfile', 'packages/importer/Dockerfile'];

describe('railway.json', () => {
  it.each(SERVICES)('apps/%s/railway.json builds its own Dockerfile', (service) => {
    const config = JSON.parse(readRepoFile(`apps/${service}/railway.json`));
    expect(config.build.builder).toBe('DOCKERFILE');
    expect(config.build.dockerfilePath).toBe(`apps/${service}/Dockerfile`);
  });

  it.each(SERVICES)(
    'apps/%s/railway.json defines no build.watchPatterns, so every railway up builds',
    (service) => {
      const config = JSON.parse(readRepoFile(`apps/${service}/railway.json`));
      expect(config.build).not.toHaveProperty('watchPatterns');
    }
  );
});

describe('Dockerfiles', () => {
  const fromLines = (content) =>
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^FROM\s/i.test(line));

  const nodeImage = (line) => /\bnode:(\S+)/.exec(line)?.[1];

  it.each(DOCKERFILES)('%s has at least one FROM node:... line', (path) => {
    const nodeFroms = fromLines(readRepoFile(path)).filter((line) => nodeImage(line));
    expect(nodeFroms.length).toBeGreaterThan(0);
  });

  it.each(DOCKERFILES)('%s pins every node base image to a literal Node 24 tag', (path) => {
    const nodeFroms = fromLines(readRepoFile(path)).filter((line) => nodeImage(line));
    for (const line of nodeFroms) {
      const tag = nodeImage(line);
      expect(tag, line).not.toContain('$');
      expect(tag, line).toMatch(/^24(?:[.-]|$)/);
    }
  });

  it.each(DOCKERFILES)('%s takes no FROM image from a build-arg substitution', (path) => {
    for (const line of fromLines(readRepoFile(path))) {
      expect(line).not.toContain('$');
    }
  });
});

describe('root package.json prepare script', () => {
  const pkg = JSON.parse(readRepoFile('package.json'));
  const prepare = pkg.scripts?.prepare;
  const tempDirs = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  const makeTempDir = (prefix) => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  };

  /**
   * Prepares a temp project dir and a bin dir holding a fake `lefthook` that records its
   * arguments to a marker file and exits with `lefthookExit`.
   */
  const setup = ({ withGit, lefthookExit = 0 }) => {
    const cwd = makeTempDir('parle-prepare-cwd-');
    const bin = makeTempDir('parle-prepare-bin-');
    const marker = join(bin, 'lefthook-calls.txt');
    if (withGit) mkdirSync(join(cwd, '.git'));
    const fake = join(bin, 'lefthook');
    writeFileSync(fake, `#!/bin/sh\necho "$*" >> '${marker}'\nexit ${lefthookExit}\n`);
    chmodSync(fake, 0o755);
    return { cwd, bin, marker };
  };

  const runPrepare = ({ cwd, bin }) =>
    spawnSync('sh', ['-c', prepare], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` },
    });

  it('is defined', () => {
    expect(typeof prepare).toBe('string');
    expect(prepare.length).toBeGreaterThan(0);
  });

  it('exits 0 without calling lefthook when there is no .git (Docker builds)', () => {
    const ctx = setup({ withGit: false });
    const result = runPrepare(ctx);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(ctx.marker)).toBe(false);
  });

  it('runs lefthook install when a .git directory exists', () => {
    const ctx = setup({ withGit: true });
    const result = runPrepare(ctx);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(ctx.marker)).toBe(true);
    expect(readFileSync(ctx.marker, 'utf8').trim()).toBe('install');
  });

  it('fails when lefthook install fails inside a git repo', () => {
    const ctx = setup({ withGit: true, lefthookExit: 1 });
    const result = runPrepare(ctx);
    expect(existsSync(ctx.marker)).toBe(true);
    expect(result.status).not.toBe(0);
  });
});
