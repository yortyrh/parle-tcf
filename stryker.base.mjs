/**
 * Shared Stryker settings: every package's stryker.config.mjs passes its own
 * `mutate` globs. Results are incremental (reports/stryker-incremental.json),
 * so re-runs only test mutants whose code or tests changed.
 */
export function strykerConfig({ mutate }) {
  return {
    testRunner: 'vitest',
    plugins: ['@stryker-mutator/vitest-runner'],
    mutate,
    coverageAnalysis: 'perTest',
    incremental: true,
    incrementalFile: 'reports/stryker-incremental.json',
    reporters: ['clear-text', 'progress', 'html', 'json'],
    htmlReporter: { fileName: 'reports/mutation/index.html' },
    jsonReporter: { fileName: 'reports/mutation/mutation.json' },
    thresholds: { high: 80, low: 70, break: 60 },
    tempDirName: '.stryker-tmp',
    ignoreStatic: true,
    concurrency: 4,
    timeoutMS: 30_000,
  };
}
