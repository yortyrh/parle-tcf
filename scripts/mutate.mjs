#!/usr/bin/env node
/**
 * `pnpm mutate`: Stryker (incremental) on the source files changed against
 * origin/main, committed or not. `pnpm mutate:full`: every package in full.
 * Fails when a package scores under its break threshold (60).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUTATION_PACKAGES, mutateTargets } from './lib/mutate-targets.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const lines = (text) => text.split('\n').filter(Boolean);

function changedFiles() {
  let base;
  try {
    base = git('merge-base', 'origin/main', 'HEAD');
  } catch {
    base = git('merge-base', 'main', 'HEAD');
  }
  return [
    ...lines(git('diff', '--name-only', `${base}...HEAD`)),
    ...lines(git('diff', '--name-only', 'HEAD')),
    ...lines(git('ls-files', '--others', '--exclude-standard')),
  ].filter((path) => existsSync(join(ROOT, path)));
}

const full = process.argv.includes('--full');
const targets = full
  ? MUTATION_PACKAGES.map((pkg) => ({ dir: pkg.dir, files: [] }))
  : mutateTargets(changedFiles());

if (targets.length === 0) {
  console.log('mutate: no changed source file to mutate.');
  process.exit(0);
}

let failed = false;
for (const { dir, files } of targets) {
  console.log(`\nmutate: ${dir}${files.length ? ` (${files.length} file(s))` : ' (full)'}`);
  const args = ['exec', 'stryker', 'run'];
  if (files.length) args.push('--mutate', files.join(','));
  const run = spawnSync('pnpm', args, { cwd: join(ROOT, dir), stdio: 'inherit' });
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
