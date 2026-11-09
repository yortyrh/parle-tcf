// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(currentDir, '..');

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'coverage', 'dist', '.turbo', 'public']);
// This file holds the regexes it asserts on; scanning itself would self-match.
const SELF_PATH = 'lib/web-bundle-security.test.ts';

function walk(dir: string, accepted: Set<string>, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, accepted, acc);
    else if (accepted.has(extname(entry))) acc.push(full);
  }
  return acc;
}

const SOURCE_FILES = walk(webRoot, SCAN_EXTENSIONS)
  .map((path) => ({
    path: relative(webRoot, path).split(sep).join('/'),
    content: readFileSync(path, 'utf8'),
  }))
  .filter((file) => file.path !== SELF_PATH);

/**
 * The browser talks to the API over HTTP only. It must never see a long-lived
 * provider key (users' keys live encrypted on the API) nor server secrets.
 */
describe('web bundle security invariants', () => {
  it('scans the web sources', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(30);
  });

  it('does not reference server-only secrets', () => {
    const secretNames =
      /\b(DATABASE_URL|BETTER_AUTH_SECRET|ENCRYPTION_KEYS|ENCRYPTION_KEY_CURRENT|SMTP_URL|OPENAI_API_KEY|[A-Z]+_CLIENT_SECRET)\b/;
    const offenders = SOURCE_FILES.filter((f) => secretNames.test(f.content)).map((f) => f.path);
    expect(offenders, 'server-only secret references in web source').toEqual([]);
  });

  it('does not import server-only packages', () => {
    const serverOnly =
      /from ['"](pg|drizzle-orm[^'"]*|nodemailer|@parle-tcf\/db[^'"]*|@nestjs\/[^'"]+)['"]/;
    const offenders = SOURCE_FILES.filter((f) => serverOnly.test(f.content)).map((f) => f.path);
    expect(offenders, 'server-only imports in web source').toEqual([]);
  });

  it('contains no hard-coded provider key', () => {
    const offenders = SOURCE_FILES.filter((f) => /sk-[A-Za-z0-9_-]{20,}/.test(f.content)).map(
      (f) => f.path
    );
    expect(offenders).toEqual([]);
  });

  // Authoritative check on the compiled output; only runs when `next build` has produced it.
  const staticDir = join(webRoot, '.next', 'static');
  it.runIf(existsSync(staticDir))('ships no provider key in the built client bundle', () => {
    const files = walk(staticDir, new Set(['.js', '.css', '.html', '.json']));
    expect(files.length).toBeGreaterThan(0);
    const offenders = files
      .filter((file) => /sk-(proj-|svcacct-)?[A-Za-z0-9_-]{32,}/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(webRoot, file));
    expect(offenders).toEqual([]);
  });
});
