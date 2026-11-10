import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MIGRATIONS_FOLDER, runMigrations } from './migrate';

const mocks = vi.hoisted(() => ({
  migrate: vi.fn(),
  createDb: vi.fn(),
  close: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres/migrator', () => ({ migrate: mocks.migrate }));
vi.mock('./client', () => ({ createDb: mocks.createDb }));

const URL = 'postgresql://user:pass@127.0.0.1:5432/parle';
const PACKAGE_DIR = path.resolve(__dirname, '..');

describe('MIGRATIONS_FOLDER', () => {
  it('points at the SQL migrations shipped with the package', () => {
    expect(MIGRATIONS_FOLDER).toBe(path.join(PACKAGE_DIR, 'migrations'));
    expect(existsSync(path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json'))).toBe(true);
  });
});

describe('runMigrations', () => {
  const db = { tag: 'db' };

  beforeEach(() => {
    mocks.migrate.mockReset();
    mocks.close.mockReset().mockResolvedValue(undefined);
    mocks.createDb.mockReset().mockReturnValue({ db, pool: {}, close: mocks.close });
  });

  it('migrates over a single connection, then closes it', async () => {
    const order: string[] = [];
    mocks.migrate.mockImplementation(async () => {
      order.push('migrate');
    });
    mocks.close.mockImplementation(async () => {
      order.push('close');
    });

    await runMigrations(URL);

    expect(mocks.createDb).toHaveBeenCalledWith({ url: URL, max: 1 });
    expect(mocks.migrate).toHaveBeenCalledWith(db, { migrationsFolder: MIGRATIONS_FOLDER });
    expect(order).toEqual(['migrate', 'close']);
  });

  it('closes the connection and rethrows when a migration fails', async () => {
    const failure = new Error('relation already exists');
    mocks.migrate.mockRejectedValue(failure);

    await expect(runMigrations(URL)).rejects.toBe(failure);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
});

describe('migrate CLI', () => {
  const tsx = path.join(PACKAGE_DIR, 'node_modules', '.bin', 'tsx');
  const run = (env: NodeJS.ProcessEnv) =>
    spawnSync(tsx, [path.join(PACKAGE_DIR, 'src', 'migrate.ts')], {
      cwd: PACKAGE_DIR,
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8',
      timeout: 30_000,
    });

  it('exits 1 without DATABASE_URL', () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('DATABASE_URL is required');
    expect(result.stdout).not.toContain('Database migrations applied');
  });

  it('exits 1 and reports the error when the database is unreachable', () => {
    // Port 1 refuses connections immediately.
    const result = run({ DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/none' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/ECONNREFUSED|connect/i);
    expect(result.stdout).not.toContain('Database migrations applied');
  });
});
