import { strykerConfig } from '../../stryker.base.mjs';

export default strykerConfig({
  // load-exercise-bank.ts is the CLI entry (env, pg pool, exit codes); its logic is in
  // exercise-bank-loader.ts.
  mutate: ['src/**/*.ts', '!src/**/*.test.ts', '!src/schema/**', '!src/load-exercise-bank.ts'],
});
