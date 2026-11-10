import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { PGlite } from '@electric-sql/pglite';
import type { Database } from './client';
import { MIGRATIONS_FOLDER } from './migrate';
import * as schema from './schema';

export interface TestDb {
  /** Typed as the production `Database`; PGlite speaks the same Postgres dialect. */
  db: Database;
  /** Inserts a row in `user` and returns its id. */
  createUser: (email?: string) => Promise<string>;
  /** Empties every table (keeps the schema). */
  truncateAll: () => Promise<void>;
  close: () => Promise<void>;
}

/** Hash of every migration file: a new or changed migration invalidates the template. */
function migrationsKey(): string {
  const hash = createHash('sha256');
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else hash.update(entry.name).update(readFileSync(path));
    }
  };
  walk(MIGRATIONS_FOLDER);
  return hash.digest('hex').slice(0, 16);
}

let templatePromise: Promise<Blob> | null = null;

/**
 * A data directory with every migration applied, built once and cached on disk
 * (os.tmpdir()) so each test file loads it instead of replaying the migrations,
 * which include the ~1 MB exercise-bank data migration.
 */
function migratedTemplate(): Promise<Blob> {
  templatePromise ??= (async () => {
    const file = join(tmpdir(), `parle-tcf-pglite-${migrationsKey()}.tar`);
    if (existsSync(file)) return new Blob([readFileSync(file)]);
    const builder = new PGlite();
    await migrate(drizzle(builder, { schema }), {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    const dump = await builder.dumpDataDir('none');
    await builder.close();
    const bytes = Buffer.from(await dump.arrayBuffer());
    // Atomic publish: parallel workers may build it at the same time.
    const partial = `${file}.${process.pid}.${randomUUID()}`;
    writeFileSync(partial, bytes);
    renameSync(partial, file);
    return new Blob([bytes]);
  })();
  return templatePromise;
}

/**
 * In-process, in-memory Postgres (PGlite) with the real migrations applied.
 * Meant for repository unit tests: no Docker, no network, real SQL semantics.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite({ loadDataDir: await migratedTemplate() });
  const pgliteDb = drizzle(client, { schema });
  const db = pgliteDb as unknown as Database;

  return {
    db,
    async createUser(email) {
      const id = randomUUID();
      await db.insert(schema.user).values({
        id,
        name: 'Test User',
        email: email ?? `${id}@test.local`,
        emailVerified: true,
      });
      return id;
    },
    async truncateAll() {
      const { rows } = await client.query<{ tablename: string }>(
        `select tablename from pg_tables where schemaname = 'public'`
      );
      if (rows.length === 0) return;
      const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
      await db.execute(sql.raw(`truncate table ${tables} cascade`));
    },
    close: () => client.close(),
  };
}
