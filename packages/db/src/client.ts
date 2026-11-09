import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
/** A database handle or an open transaction; repositories accept either. */
export type DbExecutor =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DbHandle {
  db: Database;
  pool: Pool;
  close: () => Promise<void>;
}

export interface CreateDbOptions extends Omit<PoolConfig, "connectionString"> {
  /** Postgres connection string (`postgresql://user:pass@host:5432/db`). */
  url: string;
}

export function createDb({ url, ...poolConfig }: CreateDbOptions): DbHandle {
  const pool = new Pool({ connectionString: url, max: 10, ...poolConfig });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
