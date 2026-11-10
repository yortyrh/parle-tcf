import { strykerConfig } from '../../stryker.base.mjs';

export default strykerConfig({
  mutate: ['lib/**/*.ts', '!lib/**/*.test.ts'],
});
