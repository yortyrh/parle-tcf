import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{spec,test}.ts', 'src/cli.ts'],
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 },
    },
    include: ['src/**/*.{spec,test}.ts'],
    // PGlite applies every migration (including the exercise data) per test file.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
