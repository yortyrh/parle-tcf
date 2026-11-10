import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { exerciseSessions, exercises, providerSettings, user } from './schema';
import { type TestDb, createTestDb } from './testing';

// A private tmpdir forces this file to build the migrated template from scratch
// instead of loading the copy other test files cached in the real tmpdir.
const tmp = vi.hoisted(() => ({ dir: '' }));
vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, tmpdir: () => tmp.dir };
});

const BUILD_TIMEOUT = 180_000;

describe('createTestDb', () => {
  let first: TestDb;

  beforeAll(async () => {
    const { tmpdir } = await vi.importActual<typeof import('node:os')>('node:os');
    tmp.dir = mkdtempSync(join(tmpdir(), 'parle-tcf-testing-spec-'));
    first = await createTestDb();
  }, BUILD_TIMEOUT);

  afterAll(async () => {
    await first?.close();
    rmSync(tmp.dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await first.truncateAll();
  });

  it('caches the migrated template on disk under a migrations hash', () => {
    const files = readdirSync(tmp.dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^parle-tcf-pglite-[0-9a-f]{16}\.tar$/);
    // The atomic rename leaves no partial file behind.
    expect(files.some((f) => f.includes('.tar.'))).toBe(false);
    expect(existsSync(join(tmp.dir, files[0]))).toBe(true);
  });

  it('applies every migration (data migration included)', async () => {
    const other = await createTestDb();
    try {
      const [ex] = await other.db.select({ n: count() }).from(exercises);
      const [sessions] = await other.db.select({ n: count() }).from(exerciseSessions);
      expect(ex.n).toBeGreaterThan(0);
      expect(sessions.n).toBeGreaterThan(0);
    } finally {
      await other.close();
    }
  });

  it('gives each database its own data', async () => {
    const other = await createTestDb();
    try {
      await first.createUser('isolated@test.local');
      const rows = await other.db.select().from(user).where(eq(user.email, 'isolated@test.local'));
      expect(rows).toEqual([]);
    } finally {
      await other.close();
    }
  });

  describe('createUser', () => {
    it('inserts a verified user with the given email and returns its uuid', async () => {
      const id = await first.createUser('alice@test.local');
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      const [row] = await first.db.select().from(user).where(eq(user.id, id));
      expect(row).toMatchObject({
        id,
        email: 'alice@test.local',
        name: 'Test User',
        emailVerified: true,
      });
    });

    it('derives a unique email from the id when none is given', async () => {
      const a = await first.createUser();
      const b = await first.createUser();
      expect(a).not.toBe(b);
      const rows = await first.db.select().from(user);
      expect(rows.map((r) => r.email).sort()).toEqual(
        [`${a}@test.local`, `${b}@test.local`].sort()
      );
    });
  });

  describe('truncateAll', () => {
    it('empties every public table, cascading through foreign keys', async () => {
      const userId = await first.createUser();
      await first.db.insert(providerSettings).values({
        userId,
        apiKeyCiphertext: 'c',
        iv: 'i',
        authTag: 't',
        keyVersion: 'v1',
        last4: '1234',
      });

      await first.truncateAll();

      const [users] = await first.db.select({ n: count() }).from(user);
      const [settings] = await first.db.select({ n: count() }).from(providerSettings);
      const [ex] = await first.db.select({ n: count() }).from(exercises);
      expect(users.n).toBe(0);
      expect(settings.n).toBe(0);
      expect(ex.n).toBe(0);
    });

    it('keeps the schema usable afterwards', async () => {
      await first.truncateAll();
      const id = await first.createUser('after@test.local');
      const rows = await first.db.select().from(user).where(eq(user.id, id));
      expect(rows).toHaveLength(1);
    });
  });
});
