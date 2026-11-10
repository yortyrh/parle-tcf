import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENV_KEYS, type Env, getEnv, parseCorsOrigins, resetEnvCache } from './env.js';

const REQUIRED = {
  DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/db',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEYS: `v1:${Buffer.alloc(32, 1).toString('base64')}`,
  ENCRYPTION_KEY_CURRENT: 'v1',
};

/** Clears every schema variable, then sets the given ones. */
function stubEnv(values: Record<string, string>) {
  for (const key of ENV_KEYS) vi.stubEnv(key, undefined);
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
  resetEnvCache();
}

describe('getEnv', () => {
  beforeEach(() => {
    stubEnv(REQUIRED);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it('applies the defaults', () => {
    const env = getEnv();
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      BETTER_AUTH_URL: 'http://localhost:3001',
      WEB_URL: 'http://localhost:3000',
      CORS_ORIGINS: '',
      AUTH_EMAIL_VERIFICATION_ENABLED: true,
      S3_REGION: 'auto',
      S3_FORCE_PATH_STYLE: false,
      DEFAULT_DAILY_MINUTES: 60,
      DEFAULT_MONTHLY_COST_USD: 10,
    });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.S3_BUCKET).toBeUndefined();
  });

  it('parses the environment once and caches it until reset', () => {
    const first = getEnv();
    vi.stubEnv('PORT', '4000');
    expect(getEnv()).toBe(first);
    expect(getEnv().PORT).toBe(3001);
    resetEnvCache();
    expect(getEnv().PORT).toBe(4000);
  });

  it('strips trailing slashes from the public URLs', () => {
    stubEnv({
      ...REQUIRED,
      BETTER_AUTH_URL: 'https://api.test//',
      WEB_URL: 'https://app.test/',
    });
    expect(getEnv().BETTER_AUTH_URL).toBe('https://api.test');
    expect(getEnv().WEB_URL).toBe('https://app.test');
  });

  it('treats blank optional strings as unset', () => {
    stubEnv({ ...REQUIRED, SMTP_URL: '   ', S3_BUCKET: '', GITHUB_CLIENT_ID: ' gh ' });
    const env = getEnv();
    expect(env.SMTP_URL).toBeUndefined();
    expect(env.S3_BUCKET).toBeUndefined();
    expect(env.GITHUB_CLIENT_ID).toBe('gh');
  });

  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
  ])('reads the boolean %j as %s', (raw, expected) => {
    stubEnv({ ...REQUIRED, AUTH_EMAIL_VERIFICATION_ENABLED: raw, S3_FORCE_PATH_STYLE: raw });
    expect(getEnv().AUTH_EMAIL_VERIFICATION_ENABLED).toBe(expected);
    expect(getEnv().S3_FORCE_PATH_STYLE).toBe(expected);
  });

  it('rejects other boolean spellings', () => {
    stubEnv({ ...REQUIRED, AUTH_EMAIL_VERIFICATION_ENABLED: 'yes' });
    expect(() => getEnv()).toThrow(/AUTH_EMAIL_VERIFICATION_ENABLED/);
  });

  it('coerces numbers', () => {
    stubEnv({ ...REQUIRED, PORT: '8080', DEFAULT_DAILY_MINUTES: '15' });
    expect(getEnv().PORT).toBe(8080);
    expect(getEnv().DEFAULT_DAILY_MINUTES).toBe(15);
  });

  it('lists every invalid variable in a readable error', () => {
    stubEnv({ BETTER_AUTH_SECRET: 'short', WEB_URL: 'not a url' });
    let message = '';
    try {
      getEnv();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message.startsWith('Invalid environment:\n')).toBe(true);
    expect(message).toContain('  - BETTER_AUTH_SECRET: BETTER_AUTH_SECRET must be at least 32');
    expect(message).toContain('  - DATABASE_URL:');
    expect(message).toContain('  - WEB_URL:');
    expect(message).toContain('  - ENCRYPTION_KEYS:');
    expect(message).toContain('  - ENCRYPTION_KEY_CURRENT:');
    expect(message).not.toContain('short');
  });

  it('accepts a secret of exactly 32 characters and rejects 31', () => {
    stubEnv({ ...REQUIRED, BETTER_AUTH_SECRET: 'x'.repeat(31) });
    expect(() => getEnv()).toThrow(/BETTER_AUTH_SECRET/);
    stubEnv({ ...REQUIRED, BETTER_AUTH_SECRET: 'x'.repeat(32) });
    expect(getEnv().BETTER_AUTH_SECRET).toHaveLength(32);
  });

  it('defaults to the real voice providers', () => {
    expect(getEnv().VOICE_PROVIDER).toBe('real');
  });

  it('allows the fake providers outside production', () => {
    stubEnv({ ...REQUIRED, VOICE_PROVIDER: 'fake', NODE_ENV: 'test' });
    expect(getEnv().VOICE_PROVIDER).toBe('fake');
  });

  it('refuses the fake providers in production, without caching', () => {
    stubEnv({ ...REQUIRED, VOICE_PROVIDER: 'fake', NODE_ENV: 'production' });
    expect(() => getEnv()).toThrow(
      'Invalid environment:\n  - VOICE_PROVIDER: fake is not allowed in production'
    );
    vi.stubEnv('VOICE_PROVIDER', 'real');
    expect(getEnv().VOICE_PROVIDER).toBe('real');
  });

  it('rejects an unknown voice provider', () => {
    stubEnv({ ...REQUIRED, VOICE_PROVIDER: 'mock' });
    expect(() => getEnv()).toThrow(/VOICE_PROVIDER/);
  });

  it('does not cache a failed parse', () => {
    stubEnv({ ...REQUIRED, DATABASE_URL: '' });
    expect(() => getEnv()).toThrow(/DATABASE_URL is required/);
    vi.stubEnv('DATABASE_URL', REQUIRED.DATABASE_URL);
    expect(getEnv().DATABASE_URL).toBe(REQUIRED.DATABASE_URL);
  });
});

describe('ENV_KEYS', () => {
  it('lists the schema variables', () => {
    expect(ENV_KEYS).toEqual(expect.arrayContaining(['NODE_ENV', 'DATABASE_URL', 'WEB_URL']));
    expect(new Set(ENV_KEYS).size).toBe(ENV_KEYS.length);
  });
});

describe('parseCorsOrigins', () => {
  const env = (WEB_URL: string, CORS_ORIGINS: string) => ({ WEB_URL, CORS_ORIGINS }) as Env;

  it('always allows the web app', () => {
    expect(parseCorsOrigins(env('https://app.test', ''))).toEqual(['https://app.test']);
  });

  it('adds the extra origins, trimmed and without trailing slashes', () => {
    expect(
      parseCorsOrigins(env('https://app.test', ' https://a.test/ ,https://b.test//, ,'))
    ).toEqual(['https://app.test', 'https://a.test', 'https://b.test']);
  });

  it('removes duplicates, keeping the first position', () => {
    expect(
      parseCorsOrigins(env('https://app.test', 'https://a.test,https://app.test/,https://a.test'))
    ).toEqual(['https://app.test', 'https://a.test']);
  });
});
