import { spawnSync } from 'node:child_process';

const passthroughArgs = process.argv.slice(2).filter((arg) => arg !== '--run');

const result = spawnSync(process.execPath, ['--test', '--import', 'tsx', ...passthroughArgs], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
