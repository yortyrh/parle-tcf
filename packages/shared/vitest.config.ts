import { defineConfig } from 'vitest/config';

// Without this file vitest would pick the root config (scripts only) and run no test here.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
  },
});
