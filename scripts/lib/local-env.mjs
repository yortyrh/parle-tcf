/**
 * Composes `apps/api/.env` and `apps/web/.env.local` for `pnpm setup:env`
 * (scripts/setup-local-env.mjs). Pure functions: no I/O.
 *
 * Three kinds of keys:
 *   1. Infrastructure, rewritten every run: DATABASE_URL, SMTP_URL, ports and URLs.
 *   2. Operator keys, preserved from the previous API env: auth flags, OAuth
 *      credentials, usage limits, optional S3/Resend/model settings.
 *   3. Secrets, generated once and then preserved. ENCRYPTION_KEYS is never
 *      replaced once valid: it decrypts the users' stored provider keys.
 *
 * The web env only mirrors public flags derived from the API env, so the two
 * can never disagree about which OAuth providers exist.
 */
import { randomBytes } from "node:crypto";

/** @typedef {Record<string, string>} EnvMap */

/** @param {string | null | undefined} contents @returns {EnvMap} */
export function parseDotenv(contents) {
  /** @type {EnvMap} */
  const out = {};
  if (!contents) return out;
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    const quoted = /^(["'])(.*)\1$/s.exec(value);
    if (quoted) value = quoted[2];
    if (key) out[key] = value;
  }
  return out;
}

const DEFAULT_PORTS = {
  postgresPort: ["POSTGRES_PORT", 5432],
  smtpPort: ["MAILPIT_SMTP_PORT", 1025],
  mailpitUiPort: ["MAILPIT_UI_PORT", 8025],
  apiPort: ["API_PORT", 3001],
  webPort: ["WEB_PORT", 3000],
};

/**
 * Local infrastructure ports (same variables as docker-compose.dev.yml).
 * @param {Record<string, string | undefined>} env
 */
export function devInfra(env) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const [name, [key, fallback]] of Object.entries(DEFAULT_PORTS)) {
    const raw = env[key];
    const value = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
    out[name] = Number.isInteger(value) && value > 0 ? value : fallback;
  }
  return /** @type {{ postgresPort: number, smtpPort: number, mailpitUiPort: number, apiPort: number, webPort: number }} */ (
    out
  );
}

/** 48 random bytes, base64url (64 characters). */
export function generateSecret() {
  return randomBytes(48).toString("base64url");
}

/** `v1:<base64 of 32 random bytes>` for ENCRYPTION_KEYS. */
export function generateEncryptionKey() {
  return `v1:${randomBytes(32).toString("base64")}`;
}

const KEY_ENTRY = /^(v\d+):[A-Za-z0-9+/]{43}=$/;

/** @param {string | undefined} value @returns {string[] | null} versions, or null when invalid */
function encryptionKeyVersions(value) {
  if (!value) return null;
  const entries = value.split(",").map((e) => e.trim());
  const versions = [];
  for (const entry of entries) {
    const match = KEY_ENTRY.exec(entry);
    if (!match) return null;
    versions.push(match[1]);
  }
  return versions;
}

/**
 * Keeps valid secrets and generates the missing ones.
 * @param {EnvMap} previous
 */
export function resolveSecrets(
  previous,
  gen = { secret: generateSecret, encryptionKey: generateEncryptionKey },
) {
  /** @type {EnvMap} */
  const values = {};
  /** @type {string[]} */
  const generated = [];

  const authSecret = previous.BETTER_AUTH_SECRET ?? "";
  if (authSecret.length >= 32) {
    values.BETTER_AUTH_SECRET = authSecret;
  } else {
    values.BETTER_AUTH_SECRET = gen.secret();
    generated.push("BETTER_AUTH_SECRET");
  }

  let versions = encryptionKeyVersions(previous.ENCRYPTION_KEYS);
  if (versions) {
    values.ENCRYPTION_KEYS = previous.ENCRYPTION_KEYS;
  } else {
    values.ENCRYPTION_KEYS = gen.encryptionKey();
    generated.push("ENCRYPTION_KEYS");
    versions = null;
  }

  const current = previous.ENCRYPTION_KEY_CURRENT ?? "";
  if (versions === null) {
    values.ENCRYPTION_KEY_CURRENT = "v1";
  } else if (current !== "" && versions.includes(current)) {
    values.ENCRYPTION_KEY_CURRENT = current;
  } else {
    values.ENCRYPTION_KEY_CURRENT = versions[versions.length - 1];
  }

  return { values, generated };
}

const OPERATOR_DEFAULTS = {
  GITHUB_CLIENT_ID: "",
  GITHUB_CLIENT_SECRET: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  DEFAULT_DAILY_MINUTES: "60",
  DEFAULT_MONTHLY_COST_USD: "10",
};

const OPTIONAL_KEYS = [
  "OPENAI_REALTIME_MODEL",
  "S3_BUCKET",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_FORCE_PATH_STYLE",
  "RESEND_API_KEY",
];

/** @param {string} value */
const quote = (value) =>
  /[\s#"']/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;

/**
 * @param {{ infra: ReturnType<typeof devInfra>, previous: EnvMap, secrets: EnvMap }} input
 * @returns {string}
 */
export function composeApiEnv({ infra, previous, secrets }) {
  const flag = previous.AUTH_EMAIL_VERIFICATION_ENABLED;
  const operator = Object.fromEntries(
    Object.entries(OPERATOR_DEFAULTS).map(([key, fallback]) => [
      key,
      previous[key] ?? fallback,
    ]),
  );
  const optional = OPTIONAL_KEYS.filter((key) => previous[key]).map(
    (key) => `${key}=${quote(previous[key])}`,
  );
  const lines = [
    "# Generated by `pnpm setup:env`. Re-run after changing ports (docker-compose.dev.yml).",
    "# Auth flags, OAuth credentials, limits and secrets are preserved across runs;",
    "# infrastructure keys are rewritten.",
    "",
    "# --- Infrastructure ---",
    `DATABASE_URL=postgresql://parle:parle@127.0.0.1:${infra.postgresPort}/parle`,
    `SMTP_URL=smtp://127.0.0.1:${infra.smtpPort}`,
    `MAIL_FROM=${quote("parle-tcf <no-reply@parle-tcf.local>")}`,
    `PORT=${infra.apiPort}`,
    `BETTER_AUTH_URL=http://localhost:${infra.apiPort}`,
    `WEB_URL=http://localhost:${infra.webPort}`,
    `CORS_ORIGINS=http://localhost:${infra.webPort}`,
    "",
    "# --- Secrets (generated once, then preserved) ---",
    `BETTER_AUTH_SECRET=${secrets.BETTER_AUTH_SECRET}`,
    `ENCRYPTION_KEYS=${secrets.ENCRYPTION_KEYS}`,
    `ENCRYPTION_KEY_CURRENT=${secrets.ENCRYPTION_KEY_CURRENT}`,
    "",
    "# --- Auth (operator-controlled) ---",
    `AUTH_EMAIL_VERIFICATION_ENABLED=${flag === "false" ? "false" : "true"}`,
    "# OAuth apps: callback http://localhost:<api port>/api/auth/callback/<github|google>",
    `GITHUB_CLIENT_ID=${operator.GITHUB_CLIENT_ID}`,
    `GITHUB_CLIENT_SECRET=${operator.GITHUB_CLIENT_SECRET}`,
    `GOOGLE_CLIENT_ID=${operator.GOOGLE_CLIENT_ID}`,
    `GOOGLE_CLIENT_SECRET=${operator.GOOGLE_CLIENT_SECRET}`,
    "",
    "# --- Usage limits ---",
    `DEFAULT_DAILY_MINUTES=${operator.DEFAULT_DAILY_MINUTES}`,
    `DEFAULT_MONTHLY_COST_USD=${operator.DEFAULT_MONTHLY_COST_USD}`,
    "",
    "# --- Optional (OPENAI_REALTIME_MODEL, S3_*, RESEND_API_KEY): kept when set ---",
    ...optional,
  ];
  return `${lines.join("\n")}\n`;
}

/** @param {EnvMap} apiEnv @param {"GITHUB" | "GOOGLE"} prefix */
const oauthOn = (apiEnv, prefix) =>
  Boolean(apiEnv[`${prefix}_CLIENT_ID`]) &&
  Boolean(apiEnv[`${prefix}_CLIENT_SECRET`]);

/**
 * @param {{ infra: ReturnType<typeof devInfra>, apiEnv: EnvMap }} input
 * @returns {string}
 */
export function composeWebEnv({ infra, apiEnv }) {
  return `${[
    "# Generated by `pnpm setup:env` from apps/api/.env. Public values only.",
    `NEXT_PUBLIC_EXAM_API_URL=http://localhost:${infra.apiPort}`,
    `NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED=${oauthOn(apiEnv, "GITHUB")}`,
    `NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED=${oauthOn(apiEnv, "GOOGLE")}`,
    `NEXT_PUBLIC_MAILPIT_URL=http://localhost:${infra.mailpitUiPort}`,
  ].join("\n")}\n`;
}
