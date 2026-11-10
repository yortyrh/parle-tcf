import { defineConfig } from "vitest/config";

// Root config: only the repo scripts (scripts/**/*.spec.mjs). Workspaces have their own configs.
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.spec.mjs"],
    passWithNoTests: true,
  },
});
