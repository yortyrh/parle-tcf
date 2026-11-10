import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type DbHandle, createDb } from '@parle-tcf/db';
import { getEnv } from '../config/env.js';
import { DATABASE } from './database.tokens.js';

const DB_HANDLE = Symbol('DB_HANDLE');

/**
 * Global Postgres pool (node-postgres + Drizzle). The API is the only process
 * that talks to the database; user isolation is enforced by explicit `user_id`
 * filters in every repository (no RLS).
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_HANDLE,
      useFactory: (): DbHandle => createDb({ url: getEnv().DATABASE_URL }),
    },
    {
      provide: DATABASE,
      inject: [DB_HANDLE],
      useFactory: (handle: DbHandle) => handle.db,
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(DB_HANDLE) private readonly handle: DbHandle) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.handle.close();
    } catch (error) {
      this.logger.warn(`Failed to close database pool: ${String(error)}`);
    }
  }
}
