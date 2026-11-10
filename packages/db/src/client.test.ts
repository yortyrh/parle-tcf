import { describe, expect, it } from 'vitest';
import { createDb } from './client';

// `pg.Pool` connects lazily: building a handle never opens a connection.
const URL = 'postgresql://user:pass@127.0.0.1:1/parle';

describe('createDb', () => {
  it('builds a pool from the connection string with 10 connections by default', async () => {
    const handle = createDb({ url: URL });
    try {
      expect(handle.pool.options.connectionString).toBe(URL);
      expect(handle.pool.options.max).toBe(10);
      expect(typeof handle.db.select).toBe('function');
      expect(typeof handle.db.transaction).toBe('function');
    } finally {
      await handle.close();
    }
  });

  it('lets the caller override the pool settings', async () => {
    const handle = createDb({ url: URL, max: 1, idleTimeoutMillis: 1234 });
    try {
      expect(handle.pool.options.max).toBe(1);
      expect(handle.pool.options.idleTimeoutMillis).toBe(1234);
      expect(handle.pool.options.connectionString).toBe(URL);
    } finally {
      await handle.close();
    }
  });

  it('close() ends the pool', async () => {
    const handle = createDb({ url: URL });
    expect(handle.pool.ended).toBe(false);
    await handle.close();
    expect(handle.pool.ended).toBe(true);
  });

  it('exposes the drizzle schema on the handle', async () => {
    const handle = createDb({ url: URL });
    try {
      expect(Object.keys(handle.db.query)).toEqual(
        expect.arrayContaining(['user', 'session', 'exercises'])
      );
    } finally {
      await handle.close();
    }
  });
});
