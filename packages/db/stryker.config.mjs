import { strykerConfig } from '../../stryker.base.mjs';

export default strykerConfig({
  mutate: ['src/**/*.ts', '!src/**/*.test.ts', '!src/schema/**'],
});
