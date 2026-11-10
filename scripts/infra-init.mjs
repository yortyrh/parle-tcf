#!/usr/bin/env node
/**
 * Runs after `docker compose up --wait` (`pnpm infra:up`): applies the Drizzle
 * migrations to the local database, retrying while Postgres finishes starting.
 * Idempotent; safe to re-run.
 */
import { runMigrations } from "@parle-tcf/db";
import { devInfra } from "./lib/local-env.mjs";

const infra = devInfra(process.env);
const url =
  process.env.DATABASE_URL?.trim() ||
  `postgresql://parle:parle@127.0.0.1:${infra.postgresPort}/parle`;

let lastError;
for (let attempt = 1; attempt <= 30; attempt++) {
  try {
    await runMigrations(url);
    console.log(
      `infra:init: migrations applied (${url.replace(/:[^:@/]+@/, ":***@")})`,
    );
    console.log(
      `infra:init: Mailpit inbox on http://localhost:${infra.mailpitUiPort}`,
    );
    process.exit(0);
  } catch (error) {
    lastError = error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
console.error("infra:init: could not apply migrations:", lastError);
process.exit(1);
