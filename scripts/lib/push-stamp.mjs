/**
 * Shared logic for `pnpm push` (scripts/push.mjs) and the Lefthook pre-push
 * check (scripts/check-push-stamp.mjs).
 *
 * `git push` connects to the remote before it runs the pre-push hook, so a
 * slow hook keeps an idle SSH connection open until GitHub drops it.
 * `pnpm push` therefore runs `pnpm verify` first, records the verified commit
 * in a stamp file inside `.git/`, and only then calls `git push`. The hook just
 * compares the pushed commits with the stamp, which takes milliseconds.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const STAMP_NAME = 'parle-tcf-verified-commit';
const ZERO_SHA = /^0+$/;

/** Runs git and returns trimmed stdout. */
export function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options }).trim();
}

/** Absolute path of the stamp file (worktree-aware via `--git-path`). */
export function stampPath() {
  return git(['rev-parse', '--path-format=absolute', '--git-path', STAMP_NAME]);
}

/** The commit recorded by the last successful `pnpm push` verify, or null. */
export function readStamp(path = stampPath()) {
  try {
    const { commit } = JSON.parse(readFileSync(path, 'utf8'));
    return typeof commit === 'string' && commit.length > 0 ? commit : null;
  } catch {
    return null;
  }
}

export function writeStamp(commit, path = stampPath()) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ commit, verifiedAt: new Date().toISOString() })}\n`);
}

/** True when there are no staged, unstaged or untracked (non-ignored) changes. */
export function isWorkingTreeClean() {
  return git(['status', '--porcelain']) === '';
}

/**
 * Parses the pre-push hook stdin: one line per ref,
 * `<local ref> <local sha> <remote ref> <remote sha>`.
 */
export function parsePrePushInput(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

/** Resolves a pushed object (commit or annotated tag) to its commit sha, or null. */
export function peelToCommit(sha) {
  try {
    return git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * Returns the ref updates whose commit is not the verified one. Deletions
 * (all-zero local sha) push no code and are always allowed.
 */
export function findUnverifiedUpdates(updates, verifiedCommit, peel = peelToCommit) {
  return updates.filter((update) => {
    if (ZERO_SHA.test(update.localSha)) return false;
    return verifiedCommit === null || peel(update.localSha) !== verifiedCommit;
  });
}
