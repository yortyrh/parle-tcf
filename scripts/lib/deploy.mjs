/**
 * Pure helpers for `pnpm deploy:railway` (scripts/deploy.mjs): variable checks,
 * URL consistency rules and deployment-status interpretation. No I/O here so
 * the rules stay unit-testable; the script does the Railway CLI calls.
 */

export const RAILWAY_PROJECT = 'parle-tcf';
export const RAILWAY_ENVIRONMENT = 'production';
/** Deploy order: the web build inlines the API URL, and the API pre-deploy runs the migrations. */
export const SERVICES = ['api', 'web'];

const MIN_AUTH_SECRET_LENGTH = 32;
/** Without all three the API leaves audio recording off (apps/api/src/audio/audio.module.ts). */
const STORAGE_KEYS = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const ENCRYPTION_KEY_ENTRY = /^[^:,\s]+:[A-Za-z0-9+/_-]+={0,2}$/;
/** SLEEPING = deployed and healthy, idle under Railway serverless. */
const TERMINAL_OK = new Set(['SUCCESS', 'SLEEPING']);
const TERMINAL_FAILED = new Set(['FAILED', 'CRASHED', 'REMOVED']);

/** Parses `railway variables --kv` output (KEY=value lines) into an object. */
export function parseKv(text) {
  const vars = {};
  for (const line of text.split('\n')) {
    const index = line.indexOf('=');
    if (index <= 0) continue;
    vars[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return vars;
}

/** `https://host/` -> `https://host`; bare hosts get `https://`. Empty input gives ''. */
export function normalizeUrl(value) {
  const trimmed = (value ?? '').trim().replace(/\/+$/, '');
  if (trimmed === '') return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Splits a comma-separated origin list into normalized origins. */
export function parseOrigins(value) {
  return (value ?? '')
    .split(',')
    .map((origin) => normalizeUrl(origin))
    .filter(Boolean);
}

/**
 * Picks the public URL of a service from `railway domain list --json`.
 * Custom domains win over the generated `*.up.railway.app` one.
 */
export function pickPublicUrl(domainList) {
  const domains = domainList?.domains ?? [];
  const chosen = domains.find((d) => d.type === 'custom') ?? domains[0];
  return chosen ? normalizeUrl(chosen.domain) : '';
}

const filled = (vars, key) => (vars[key] ?? '').trim() !== '';

/**
 * Problems with the API service variables. Each problem is
 * `{ service, message, fix }`; `fix` is what the person has to do.
 */
export function checkApiVariables(vars) {
  const problems = [];
  const missing = (key, fix) =>
    problems.push({ service: 'api', message: `${key} is not set`, fix: fix ?? `set ${key}` });

  if (!filled(vars, 'DATABASE_URL')) {
    missing(
      'DATABASE_URL',
      'add a PostgreSQL service to the project and set DATABASE_URL=${{Postgres.DATABASE_URL}} on api'
    );
  }
  if (!filled(vars, 'BETTER_AUTH_SECRET')) {
    missing('BETTER_AUTH_SECRET', 'set it to the output of: openssl rand -base64 32');
  } else if (vars.BETTER_AUTH_SECRET.length < MIN_AUTH_SECRET_LENGTH) {
    problems.push({
      service: 'api',
      message: `BETTER_AUTH_SECRET is shorter than ${MIN_AUTH_SECRET_LENGTH} characters`,
      fix: 'regenerate it with: openssl rand -base64 32',
    });
  }
  const urlFixes = {
    BETTER_AUTH_URL: 'set it to the public HTTPS URL of the api service',
    WEB_URL: 'set it to the public HTTPS URL of the web service',
    CORS_ORIGINS: 'set it to the public HTTPS URL of the web service',
  };
  for (const [key, fix] of Object.entries(urlFixes)) {
    if (!filled(vars, key)) missing(key, fix);
  }
  if (!filled(vars, 'ENCRYPTION_KEYS')) {
    missing('ENCRYPTION_KEYS', 'set it to v1:<output of: openssl rand -base64 32>');
  } else if (!vars.ENCRYPTION_KEYS.split(',').every((e) => ENCRYPTION_KEY_ENTRY.test(e.trim()))) {
    problems.push({
      service: 'api',
      message: 'ENCRYPTION_KEYS is not a list of <version>:<base64> entries',
      fix: 'use v1:<output of: openssl rand -base64 32>',
    });
  }
  if (!filled(vars, 'ENCRYPTION_KEY_CURRENT')) {
    missing('ENCRYPTION_KEY_CURRENT', 'set it to the version in ENCRYPTION_KEYS, e.g. v1');
  } else if (
    filled(vars, 'ENCRYPTION_KEYS') &&
    !vars.ENCRYPTION_KEYS.split(',').some((e) =>
      e.trim().startsWith(`${vars.ENCRYPTION_KEY_CURRENT}:`)
    )
  ) {
    problems.push({
      service: 'api',
      message: 'ENCRYPTION_KEY_CURRENT does not name a version listed in ENCRYPTION_KEYS',
      fix: 'make them match (e.g. v1)',
    });
  }
  if (!filled(vars, 'RESEND_API_KEY') && !filled(vars, 'SMTP_URL')) {
    problems.push({
      service: 'api',
      message: 'no mail transport: the API refuses to start in production without one',
      fix: 'set RESEND_API_KEY (recommended on Railway, SMTP is usually blocked) or SMTP_URL',
    });
  }
  if (!filled(vars, 'MAIL_FROM')) {
    missing(
      'MAIL_FROM',
      'set a sender on a verified domain, e.g. "parle-tcf <no-reply@your-domain>"'
    );
  }
  if ((vars.VOICE_PROVIDER ?? 'real') === 'fake') {
    problems.push({
      service: 'api',
      message: 'VOICE_PROVIDER=fake is refused in production',
      fix: 'delete VOICE_PROVIDER',
    });
  }
  // Audio is optional, but a partial S3 config turns it off without a word.
  const storageSet = STORAGE_KEYS.filter((key) => filled(vars, key));
  if (storageSet.length > 0 && storageSet.length < STORAGE_KEYS.length) {
    const absent = STORAGE_KEYS.filter((key) => !storageSet.includes(key));
    problems.push({
      service: 'api',
      message: `S3 storage is partly configured (missing ${absent.join(', ')}): audio recording stays off`,
      fix: `set ${STORAGE_KEYS.join(', ')} as references to the Railway bucket (\${{<bucket>.BUCKET}}, ...), or delete them all`,
    });
  }
  return problems;
}

/** Problems with the web service variables (build-time, inlined by Next.js). */
export function checkWebVariables(vars) {
  const problems = [];
  if (!filled(vars, 'NEXT_PUBLIC_EXAM_API_URL')) {
    problems.push({
      service: 'web',
      message: 'NEXT_PUBLIC_EXAM_API_URL is not set (the image would call http://localhost:3001)',
      fix: 'set it to the public HTTPS URL of the api service',
    });
  }
  return problems;
}

/** Cross-service rules: the URLs the services advertise must match the real public URLs. */
export function checkConsistency({ apiVars, webVars, apiUrl, webUrl }) {
  const problems = [];
  if (!apiUrl) {
    problems.push({
      service: 'api',
      message: 'no public domain',
      fix: 'railway domain -s api (or add a custom domain in the dashboard)',
    });
  }
  if (!webUrl) {
    problems.push({
      service: 'web',
      message: 'no public domain',
      fix: 'railway domain -s web (or add a custom domain in the dashboard)',
    });
  }
  const expect = (service, key, actual, wanted) => {
    if (wanted && actual && normalizeUrl(actual) !== wanted) {
      problems.push({
        service,
        message: `${key} is ${actual} but the public URL is ${wanted}`,
        fix: `set ${key}=${wanted}`,
      });
    }
  };
  expect('api', 'BETTER_AUTH_URL', apiVars.BETTER_AUTH_URL, apiUrl);
  expect('api', 'WEB_URL', apiVars.WEB_URL, webUrl);
  expect('web', 'NEXT_PUBLIC_EXAM_API_URL', webVars.NEXT_PUBLIC_EXAM_API_URL, apiUrl);
  if (
    webUrl &&
    filled(apiVars, 'CORS_ORIGINS') &&
    !parseOrigins(apiVars.CORS_ORIGINS).includes(webUrl)
  ) {
    problems.push({
      service: 'api',
      message: `CORS_ORIGINS does not include ${webUrl}: the browser would block every API call`,
      fix: `set CORS_ORIGINS=${webUrl}`,
    });
  }
  return problems;
}

/**
 * `'ok' | 'skipped' | 'failed' | 'pending'` for a Railway deployment status.
 * `skipped`: Railway did not build because its watch paths saw no change, so nothing was deployed.
 */
export function deploymentOutcome(status) {
  if (TERMINAL_OK.has(status)) return 'ok';
  if (status === 'SKIPPED') return 'skipped';
  if (TERMINAL_FAILED.has(status)) return 'failed';
  return 'pending';
}

/** Services to deploy for a CLI target: `all` (default), `api` or `web`, in deploy order. */
export function servicesFor(target = 'all') {
  if (target === 'all') return [...SERVICES];
  if (SERVICES.includes(target)) return [target];
  throw new Error(`Unknown target "${target}". Use one of: all, ${SERVICES.join(', ')}.`);
}

/** Formats problems as a readable list grouped by service. */
export function formatProblems(problems) {
  return problems.map((p) => `  [${p.service}] ${p.message}\n      -> ${p.fix}`).join('\n');
}
