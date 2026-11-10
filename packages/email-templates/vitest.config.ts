import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{spec,test}.{ts,tsx}'],
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 },
    },
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
  },
});
