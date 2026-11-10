import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Supertest integration suite: real AppModule, Postgres 17 and Mailpit in
 * Testcontainers (Docker or Podman required). `pnpm test:integration`.
 */
export default defineConfig({
  // Nest's DI needs decorator metadata, which esbuild does not emit; SWC does.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['test/integration/**/*.spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    // One database for the run: files run one after the other.
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
