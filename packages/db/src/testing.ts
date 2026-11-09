import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Database } from "./client";
import { MIGRATIONS_FOLDER } from "./migrate";
import * as schema from "./schema";

export interface TestDb {
  /** Typed as the production `Database`; PGlite speaks the same Postgres dialect. */
  db: Database;
  /** Inserts a row in `user` and returns its id. */
  createUser: (email?: string) => Promise<string>;
  /** Empties every table (keeps the schema). */
  truncateAll: () => Promise<void>;
  close: () => Promise<void>;
}

/**
 * In-process, in-memory Postgres (PGlite) with the real migrations applied.
 * Meant for repository unit tests: no Docker, no network, real SQL semantics.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const pgliteDb = drizzle(client, { schema });
  await migrate(pgliteDb, { migrationsFolder: MIGRATIONS_FOLDER });
  const db = pgliteDb as unknown as Database;

  return {
    db,
    async createUser(email) {
      const id = randomUUID();
      await db.insert(schema.user).values({
        id,
        name: "Test User",
        email: email ?? `${id}@test.local`,
        emailVerified: true,
      });
      return id;
    },
    async truncateAll() {
      const { rows } = await client.query<{ tablename: string }>(
        `select tablename from pg_tables where schemaname = 'public'`,
      );
      if (rows.length === 0) return;
      const tables = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
      await db.execute(sql.raw(`truncate table ${tables} cascade`));
    },
    close: () => client.close(),
  };
}
