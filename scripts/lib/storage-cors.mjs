/**
 * Pure helpers for `pnpm storage:cors` (scripts/storage-cors.mjs) and the local
 * infra setup: the bucket CORS rules the browser needs (presigned POST upload
 * from the web origin, signed GET playback) and the remote target read from env.
 */
import { parseOrigins } from './deploy.mjs';

const REQUIRED_KEYS = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'CORS_ORIGINS'];
const TRUE_VALUES = new Set(['true', '1']);

/**
 * One rule allowing GET and POST from the given origins.
 * @param {string[]} origins
 */
export function corsRulesFor(origins) {
  if (origins.length === 0) throw new Error('corsRulesFor: at least one origin is required');
  return [
    {
      AllowedOrigins: [...origins],
      AllowedMethods: ['GET', 'POST'],
      AllowedHeaders: ['*'],
      MaxAgeSeconds: 3000,
    },
  ];
}

const trimmed = (value) => (value ?? '').trim();

/**
 * Bucket, credentials and web origins from the API env (S3_* and CORS_ORIGINS).
 * Throws naming every missing key, never the values.
 * @param {Record<string, string | undefined>} env
 */
export function storageTargetFromEnv(env) {
  const origins = parseOrigins(env.CORS_ORIGINS);
  const missing = REQUIRED_KEYS.filter((key) =>
    key === 'CORS_ORIGINS' ? origins.length === 0 : trimmed(env[key]) === ''
  );
  if (missing.length > 0) {
    throw new Error(`storage:cors: missing ${missing.join(', ')}`);
  }
  return {
    bucket: trimmed(env.S3_BUCKET),
    endpoint: trimmed(env.S3_ENDPOINT) || undefined,
    region: trimmed(env.S3_REGION) || 'auto',
    accessKeyId: trimmed(env.S3_ACCESS_KEY_ID),
    secretAccessKey: trimmed(env.S3_SECRET_ACCESS_KEY),
    forcePathStyle: TRUE_VALUES.has(trimmed(env.S3_FORCE_PATH_STYLE)),
    origins,
  };
}

const sameSet = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((item) => right.has(item));
};

/**
 * Whether the rules read back with GetBucketCors are the expected ones, rule by
 * rule; list order inside a rule and extra provider fields are ignored.
 * @param {unknown} applied
 * @param {ReturnType<typeof corsRulesFor>} expected
 */
export function corsMatches(applied, expected) {
  if (!Array.isArray(applied) || applied.length !== expected.length) return false;
  return expected.every((rule, index) => {
    const got = applied[index] ?? {};
    return (
      sameSet(got.AllowedOrigins, rule.AllowedOrigins) &&
      sameSet(got.AllowedMethods, rule.AllowedMethods) &&
      sameSet(got.AllowedHeaders, rule.AllowedHeaders) &&
      got.MaxAgeSeconds === rule.MaxAgeSeconds
    );
  });
}
