#!/usr/bin/env node
// Fails fast when the running Node major differs from `.nvmrc` (local/CI parity). `.nvmrc`
// mirrors `devEngines.runtime` in package.json, which pnpm uses to install the Node.js LTS.
import { readFileSync } from 'node:fs';

const wanted = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8')
  .trim()
  .replace(/^v/, '');
const wantedMajor = Number.parseInt(wanted.split('.')[0], 10);
const major = Number.parseInt(process.versions.node.split('.')[0], 10);

if (major !== wantedMajor) {
  console.error(`Node ${wantedMajor}.x is required (.nvmrc), current: ${process.version}.`);
  console.error(
    'Run it through pnpm (`pnpm verify`): pnpm installs the pinned Node.js from devEngines.runtime.'
  );
  console.error('For the global `node`, run `pnpm runtime set node lts -g` and retry.');
  process.exit(1);
}
