import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // PGlite cold start is slow when turbo runs every package in parallel.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
