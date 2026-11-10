import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional();

/** Strips trailing slashes so URLs can be concatenated safely. */
const url = z
  .string()
  .url()
  .transform((v) => v.replace(/\/+$/, ''));

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Public URL of this API; Better Auth builds OAuth callbacks from it. */
  BETTER_AUTH_URL: url.default('http://localhost:3001'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  /** Public URL of the web app; email links land there. */
  WEB_URL: url.default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default(''),
  /**
   * Master keys for provider-key encryption: `v1:<base64 of 32 bytes>,v2:...`.
   * `ENCRYPTION_KEY_CURRENT` names the one used for new writes.
   */
  ENCRYPTION_KEYS: z.string().min(1, 'ENCRYPTION_KEYS is required'),
  ENCRYPTION_KEY_CURRENT: z.string().min(1, 'ENCRYPTION_KEY_CURRENT is required'),
  AUTH_EMAIL_VERIFICATION_ENABLED: bool.default(true),
  /** Resend HTTPS API key; takes precedence over SMTP_URL (see mail/mail-transport.ts). */
  RESEND_API_KEY: optionalString,
  SMTP_URL: optionalString,
  MAIL_FROM: z.string().default('parle-tcf <no-reply@localhost>'),
  /** S3-compatible storage (R2, MinIO, S3) for attempt recordings; unset = audio disabled. */
  S3_BUCKET: optionalString,
  S3_ENDPOINT: optionalString,
  S3_REGION: z.string().default('auto'),
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: bool.default(false),
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  /** Default usage limits for users without a `usage_limits` row (phase 2). */
  DEFAULT_DAILY_MINUTES: z.coerce.number().default(60),
  DEFAULT_MONTHLY_COST_USD: z.coerce.number().default(10),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Validated environment, parsed once. Throws a readable error when invalid. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: forget the cached environment. */
export function resetEnvCache(): void {
  cached = null;
}

export function parseCorsOrigins(env: Env): string[] {
  return [
    ...new Set(
      [env.WEB_URL, ...env.CORS_ORIGINS.split(',')]
        .map((s) => s.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    ),
  ];
}
