import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/contract/**',
        'src/test-helpers.ts',
      ],
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 },
    },
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true,
    // PGlite cold start is slow when turbo runs every package in parallel.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
