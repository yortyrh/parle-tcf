import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{spec,test}.ts'],
    // PGlite applies every migration (including the exercise data) per test file.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
