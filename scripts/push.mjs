#!/usr/bin/env node
/**
 * `pnpm push [git push args...]`: verify, then push.
 *
 * Runs the checks before `git push` opens the connection to the remote, so a
 * long verify can no longer make the push fail on an idle SSH connection.
 * See scripts/lib/push-stamp.mjs.
 */
import { spawnSync } from 'node:child_process';
import { git, isWorkingTreeClean, readStamp, writeStamp } from './lib/push-stamp.mjs';

function fail(message) {
  console.error(`\npnpm push: ${message}`);
  process.exit(1);
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.error) fail(`could not run \`${command}\`: ${result.error.message}`);
  return result.status ?? 1;
}

if (!isWorkingTreeClean()) {
  fail(
    'the working tree has uncommitted or untracked changes. Commit or stash them first, ' +
      'so verify checks exactly what is pushed.'
  );
}

const head = git(['rev-parse', 'HEAD']);

if (readStamp() === head) {
  console.log(`pnpm push: ${head.slice(0, 12)} already verified, skipping verify.`);
} else {
  const env = {
    ...process.env,
    NEXT_PUBLIC_EXAM_API_URL: process.env.NEXT_PUBLIC_EXAM_API_URL ?? 'http://localhost:3001',
  };
  if (run('pnpm', ['verify'], env) !== 0) fail('verify failed; nothing was pushed.');

  if (git(['rev-parse', 'HEAD']) !== head || !isWorkingTreeClean()) {
    fail('HEAD or the working tree changed while verify ran; run `pnpm push` again.');
  }
  writeStamp(head);
}

// `pnpm push -- <args>` forwards the `--` itself; git would read it as the end
// of options and take every flag after it as a refspec.
const pushArgs = process.argv.slice(2);
if (pushArgs[0] === '--') pushArgs.shift();

process.exit(run('git', ['push', ...pushArgs]));
