import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig has `jsx: preserve` for Next; tests need the automatic runtime (no React import).
  esbuild: { jsx: 'automatic' },
  test: {
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'hooks/**/*.{ts,tsx}', 'components/**/*.tsx', 'providers/**/*.tsx'],
      // shadcn primitives are generated (`shadcn add`), not ours to cover.
      exclude: ['**/*.test.{ts,tsx}', 'components/ui/**'],
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 70, branches: 70, functions: 70, statements: 70 },
    },
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'node', include: ['**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
