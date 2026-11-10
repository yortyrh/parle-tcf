#!/usr/bin/env node
/**
 * `pnpm samples:seed`: creates the local dev users (scripts/lib/dev-users.mjs)
 * with verified emails and email/password accounts, straight in Postgres.
 * Passwords are generated once per machine into .samples/local-credentials.json
 * (gitignored); re-running keeps them and resets the stored hashes to match.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { account, and, createDb, eq, user } from "@parle-tcf/db";
import { hashPassword } from "better-auth/crypto";
import { DEV_USERS, resolveCredentials } from "./lib/dev-users.mjs";
import { devInfra, parseDotenv } from "./lib/local-env.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CREDENTIALS = join(ROOT, ".samples/local-credentials.json");
const API_ENV = join(ROOT, "apps/api/.env");

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const apiEnv = existsSync(API_ENV)
  ? parseDotenv(readFileSync(API_ENV, "utf8"))
  : {};
const url =
  process.env.DATABASE_URL?.trim() ||
  apiEnv.DATABASE_URL ||
  `postgresql://parle:parle@127.0.0.1:${devInfra(process.env).postgresPort}/parle`;

const { credentials, generated } = resolveCredentials(
  readJson(CREDENTIALS),
  () => randomBytes(18).toString("base64url"),
);
mkdirSync(dirname(CREDENTIALS), { recursive: true });
writeFileSync(CREDENTIALS, `${JSON.stringify({ credentials }, null, 2)}\n`, {
  mode: 0o600,
});

const handle = createDb({ url, max: 1 });
try {
  for (const devUser of DEV_USERS) {
    const [row] = await handle.db
      .insert(user)
      .values({ name: devUser.name, email: devUser.email, emailVerified: true })
      .onConflictDoUpdate({
        target: user.email,
        set: { emailVerified: true, name: devUser.name },
      })
      .returning({ id: user.id });
    const password = await hashPassword(credentials[devUser.email]);
    await handle.db
      .delete(account)
      .where(
        and(eq(account.userId, row.id), eq(account.providerId, "credential")),
      );
    await handle.db.insert(account).values({
      userId: row.id,
      accountId: row.id,
      providerId: "credential",
      password,
    });
    console.log(`samples:seed: ${devUser.email}`);
  }
} finally {
  await handle.close();
}
if (generated.length > 0)
  console.log(`samples:seed: new passwords for ${generated.join(", ")}`);
console.log("samples:seed: passwords with `pnpm local:credentials`");
