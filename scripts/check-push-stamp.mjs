#!/usr/bin/env node
/**
 * Lefthook pre-push check: only commits verified by `pnpm push` may be pushed.
 *
 * Runs in milliseconds, so the connection git already opened to the remote
 * does not sit idle. See scripts/lib/push-stamp.mjs.
 */
import { readFileSync } from 'node:fs';
import { findUnverifiedUpdates, parsePrePushInput, readStamp } from './lib/push-stamp.mjs';

const updates = parsePrePushInput(readFileSync(0, 'utf8'));
const unverified = findUnverifiedUpdates(updates, readStamp());

if (unverified.length > 0) {
  console.error('Push blocked: these refs point to commits that `pnpm verify` has not checked:');
  for (const { localRef, localSha } of unverified) {
    console.error(`  ${localRef} (${localSha.slice(0, 12)})`);
  }
  console.error(
    '\nPush with `pnpm push [git push args...]` instead of `git push`: it runs verify before ' +
      'connecting to the remote, then pushes. It verifies the checked-out commit (HEAD).'
  );
  process.exit(1);
}
