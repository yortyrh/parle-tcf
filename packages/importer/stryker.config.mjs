import { strykerConfig } from '../../stryker.base.mjs';

export default strykerConfig({
  mutate: ['src/**/*.ts', '!src/**/*.{spec,test}.ts', '!src/cli.ts'],
});
