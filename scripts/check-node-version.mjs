#!/usr/bin/env node
// Fails fast when the running Node major differs from `.nvmrc` (local/CI parity).
import { readFileSync } from "node:fs";

const wanted = readFileSync(new URL("../.nvmrc", import.meta.url), "utf8")
  .trim()
  .replace(/^v/, "");
const wantedMajor = Number.parseInt(wanted.split(".")[0], 10);
const major = Number.parseInt(process.versions.node.split(".")[0], 10);

if (major !== wantedMajor) {
  console.error(
    `Node ${wantedMajor}.x is required (.nvmrc), current: ${process.version}.`,
  );
  console.error("Run `nvm use` (or your version manager) and retry.");
  process.exit(1);
}
