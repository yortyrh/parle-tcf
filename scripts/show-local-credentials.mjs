#!/usr/bin/env node
/** `pnpm local:credentials`: prints the local dev users created by `pnpm samples:seed`. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const path = join(
  dirname(fileURLToPath(import.meta.url)),
  "../.samples/local-credentials.json",
);
try {
  const { credentials } = JSON.parse(readFileSync(path, "utf8"));
  for (const [email, password] of Object.entries(credentials))
    console.log(`${email}  ${password}`);
} catch {
  console.error("No local credentials yet: run `pnpm samples:seed`.");
  process.exit(1);
}
