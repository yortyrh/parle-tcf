import { strykerConfig } from '../../stryker.base.mjs';

export default strykerConfig({
  mutate: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/contract/**',
    '!src/test-helpers.ts',
  ],
});
