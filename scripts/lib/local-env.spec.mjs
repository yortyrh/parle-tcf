import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  composeApiEnv,
  composeWebEnv,
  devInfra,
  devStorage,
  generateEncryptionKey,
  generateSecret,
  parseDotenv,
  resolveSecrets,
  storageCorsRules,
} from './local-env.mjs';

const DEV_COMPOSE = readFileSync(new URL('../../docker-compose.dev.yml', import.meta.url), 'utf8');

const KEY_RE = /^v\d+:[A-Za-z0-9+/]{43}=$/;
const keyOf = (version, byte) => `${version}:${Buffer.alloc(32, byte).toString('base64')}`;
const K1 = keyOf('v1', 1);
const K2 = keyOf('v2', 2);
const SECRET_32 = 's'.repeat(32);
const SECRET_31 = 's'.repeat(31);

const fakeGen = () => {
  const gen = {
    secret: vi.fn(() => 'GENERATED_SECRET_'.padEnd(40, 'x')),
    encryptionKey: vi.fn(() => keyOf('v1', 9)),
  };
  return gen;
};

const INFRA = {
  postgresPort: 5544,
  smtpPort: 2025,
  mailpitUiPort: 9025,
  apiPort: 4001,
  webPort: 4000,
  storagePort: 9100,
  storageConsolePort: 9101,
};

const SECRETS = {
  BETTER_AUTH_SECRET: 'b'.repeat(64),
  ENCRYPTION_KEYS: `${K1},${K2}`,
  ENCRYPTION_KEY_CURRENT: 'v2',
};

const OPTIONAL_KEYS = ['OPENAI_REALTIME_MODEL', 'RESEND_API_KEY'];

const S3_KEYS = [
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_FORCE_PATH_STYLE',
];

/** The S3 block composeApiEnv must write for INFRA (local RustFS). */
const LOCAL_S3 = {
  S3_BUCKET: 'parle-tcf-audio',
  S3_ENDPOINT: 'http://127.0.0.1:9100',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'parle',
  S3_SECRET_ACCESS_KEY: 'parle-dev-secret',
  S3_FORCE_PATH_STYLE: 'true',
};

const STALE_S3 = {
  S3_BUCKET: 'recordings',
  S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
  S3_REGION: 'auto',
  S3_ACCESS_KEY_ID: 'AKIA123',
  S3_SECRET_ACCESS_KEY: 's3-secret',
  S3_FORCE_PATH_STYLE: 'false',
};

/** @param {string} body @param {string} key */
const countKey = (body, key) =>
  body.split('\n').filter((line) => line.startsWith(`${key}=`)).length;

const apiEnvOf = (previous = {}) =>
  parseDotenv(composeApiEnv({ infra: INFRA, previous, secrets: SECRETS }));

describe('parseDotenv', () => {
  it('parses the reference example', () => {
    const input = 'A=1\n# c\n\nB = two words \nC="x=y"\nD=\'q\'\nnoequals';
    expect(parseDotenv(input)).toEqual({
      A: '1',
      B: 'two words',
      C: 'x=y',
      D: 'q',
    });
  });

  it.each([null, undefined, ''])('returns {} for %j', (value) => {
    expect(parseDotenv(value)).toEqual({});
  });

  it('ignores indented comments and whitespace-only lines', () => {
    expect(parseDotenv('   # A=1\n   \nB=2')).toEqual({ B: '2' });
  });

  it('splits on the first = only', () => {
    expect(parseDotenv('URL=postgres://u:p@h/db?a=b')).toEqual({
      URL: 'postgres://u:p@h/db?a=b',
    });
  });

  it('keeps an empty value', () => {
    expect(parseDotenv('EMPTY=\nQUOTED=""')).toEqual({
      EMPTY: '',
      QUOTED: '',
    });
  });

  it('strips exactly one pair of matching quotes', () => {
    expect(parseDotenv('A=""x""\nB=\'\'y\'\'')).toEqual({
      A: '"x"',
      B: "'y'",
    });
  });

  it('keeps mismatched or one-sided quotes', () => {
    expect(parseDotenv('A="x\'\nB=\'y"\nC="z\nD=w"')).toEqual({
      A: '"x\'',
      B: '\'y"',
      C: '"z',
      D: 'w"',
    });
  });

  it('trims around the quotes but keeps spaces inside them', () => {
    expect(parseDotenv('A= " padded "  ')).toEqual({ A: ' padded ' });
  });
});

describe('devInfra', () => {
  it('uses the defaults when nothing is set', () => {
    expect(devInfra({})).toEqual({
      postgresPort: 5432,
      smtpPort: 1025,
      mailpitUiPort: 8025,
      apiPort: 3001,
      webPort: 3000,
      storagePort: 9000,
      storageConsolePort: 9001,
    });
  });

  it('reads every port from its own variable as a number', () => {
    expect(
      devInfra({
        POSTGRES_PORT: '5433',
        MAILPIT_SMTP_PORT: '1026',
        MAILPIT_UI_PORT: '8026',
        API_PORT: '3101',
        WEB_PORT: '3100',
        STORAGE_PORT: '9200',
        STORAGE_CONSOLE_PORT: '9201',
      })
    ).toEqual({
      postgresPort: 5433,
      smtpPort: 1026,
      mailpitUiPort: 8026,
      apiPort: 3101,
      webPort: 3100,
      storagePort: 9200,
      storageConsolePort: 9201,
    });
  });

  it('reads the storage ports independently (no swap between API and console)', () => {
    expect(devInfra({ STORAGE_PORT: '9300' })).toMatchObject({
      storagePort: 9300,
      storageConsolePort: 9001,
    });
    expect(devInfra({ STORAGE_CONSOLE_PORT: '9301' })).toMatchObject({
      storagePort: 9000,
      storageConsolePort: 9301,
    });
  });

  it.each([[''], ['   '], ['abc'], ['0'], ['-9000'], ['9000.5']])(
    'falls back to the default storage ports for %j',
    (raw) => {
      expect(devInfra({ STORAGE_PORT: raw, STORAGE_CONSOLE_PORT: raw })).toMatchObject({
        storagePort: 9000,
        storageConsolePort: 9001,
      });
    }
  );

  it('falls back per key for empty or non-numeric values', () => {
    expect(
      devInfra({
        POSTGRES_PORT: '',
        MAILPIT_SMTP_PORT: 'abc',
        MAILPIT_UI_PORT: '8030',
        API_PORT: 'not-a-port',
        WEB_PORT: undefined,
        STORAGE_PORT: 'nope',
        STORAGE_CONSOLE_PORT: '9031',
      })
    ).toEqual({
      postgresPort: 5432,
      smtpPort: 1025,
      mailpitUiPort: 8030,
      apiPort: 3001,
      webPort: 3000,
      storagePort: 9000,
      storageConsolePort: 9031,
    });
  });

  it('returns numbers, not strings', () => {
    const infra = devInfra({
      API_PORT: '3201',
      STORAGE_PORT: '9400',
      STORAGE_CONSOLE_PORT: '9401',
    });
    expect(Object.keys(infra)).toHaveLength(7);
    for (const value of Object.values(infra)) {
      expect(typeof value).toBe('number');
    }
  });

  it('uses the same storage port variables and defaults as docker-compose.dev.yml', () => {
    const defaults = devInfra({});
    expect(DEV_COMPOSE).toContain(`'\${STORAGE_PORT:-${defaults.storagePort}}:9000'`);
    expect(DEV_COMPOSE).toContain(
      `'\${STORAGE_CONSOLE_PORT:-${defaults.storageConsolePort}}:9001'`
    );
  });
});

describe('devStorage', () => {
  it('describes the local RustFS bucket for the given infra', () => {
    expect(devStorage(INFRA)).toEqual({
      endpoint: 'http://127.0.0.1:9100',
      region: 'us-east-1',
      bucket: 'parle-tcf-audio',
      accessKeyId: 'parle',
      secretAccessKey: 'parle-dev-secret',
      forcePathStyle: true,
    });
  });

  it('points at the S3 API port, not the console port', () => {
    const storage = devStorage({ ...INFRA, storagePort: 9555, storageConsolePort: 9556 });
    expect(storage.endpoint).toBe('http://127.0.0.1:9555');
  });

  it('uses the default port with devInfra defaults', () => {
    expect(devStorage(devInfra({})).endpoint).toBe('http://127.0.0.1:9000');
  });

  it('forces path-style addressing (boolean true)', () => {
    expect(devStorage(INFRA).forcePathStyle).toBe(true);
  });

  it('uses the credentials of the storage service in docker-compose.dev.yml', () => {
    const { accessKeyId, secretAccessKey } = devStorage(INFRA);
    expect(DEV_COMPOSE).toMatch(new RegExp(`^\\s*RUSTFS_ACCESS_KEY:\\s*${accessKeyId}\\s*$`, 'm'));
    expect(DEV_COMPOSE).toMatch(
      new RegExp(`^\\s*RUSTFS_SECRET_KEY:\\s*${secretAccessKey}\\s*$`, 'm')
    );
  });
});

describe('storageCorsRules', () => {
  it('allows GET and POST from the web origin only', () => {
    expect(storageCorsRules(INFRA)).toEqual([
      {
        AllowedOrigins: ['http://localhost:4000'],
        AllowedMethods: ['GET', 'POST'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 3000,
      },
    ]);
  });

  it('follows the web port, not the API port', () => {
    const [rule] = storageCorsRules({ ...INFRA, webPort: 3555, apiPort: 3556 });
    expect(rule.AllowedOrigins).toEqual(['http://localhost:3555']);
  });

  it('never allows a wildcard origin, PUT or DELETE', () => {
    for (const rule of storageCorsRules(devInfra({}))) {
      expect(rule.AllowedOrigins).not.toContain('*');
      expect(rule.AllowedMethods).not.toContain('PUT');
      expect(rule.AllowedMethods).not.toContain('DELETE');
    }
  });
});

describe('generateSecret', () => {
  it('is 64 base64url characters encoding 48 bytes', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(Buffer.from(secret, 'base64url')).toHaveLength(48);
  });

  it('differs between calls', () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });
});

describe('generateEncryptionKey', () => {
  it('is v1: followed by standard base64 of 32 bytes', () => {
    const key = generateEncryptionKey();
    expect(key.startsWith('v1:')).toBe(true);
    const encoded = key.slice(3);
    expect(encoded).toHaveLength(44);
    expect(encoded).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(Buffer.from(encoded, 'base64')).toHaveLength(32);
  });

  it('differs between calls', () => {
    expect(generateEncryptionKey()).not.toBe(generateEncryptionKey());
  });
});

describe('resolveSecrets', () => {
  it('generates everything from an empty previous env', () => {
    const gen = fakeGen();
    const result = resolveSecrets({}, gen);
    expect(result).toEqual({
      values: {
        BETTER_AUTH_SECRET: gen.secret.mock.results[0].value,
        ENCRYPTION_KEYS: keyOf('v1', 9),
        ENCRYPTION_KEY_CURRENT: 'v1',
      },
      generated: ['BETTER_AUTH_SECRET', 'ENCRYPTION_KEYS'],
    });
    expect(gen.secret).toHaveBeenCalledTimes(1);
    expect(gen.encryptionKey).toHaveBeenCalledTimes(1);
  });

  it('keeps everything that is already valid without generating', () => {
    const gen = fakeGen();
    const previous = {
      BETTER_AUTH_SECRET: SECRET_32,
      ENCRYPTION_KEYS: K1,
      ENCRYPTION_KEY_CURRENT: 'v1',
    };
    expect(resolveSecrets(previous, gen)).toEqual({
      values: previous,
      generated: [],
    });
    expect(gen.secret).not.toHaveBeenCalled();
    expect(gen.encryptionKey).not.toHaveBeenCalled();
  });

  it('keeps a 32-character secret and regenerates a 31-character one', () => {
    const keep = resolveSecrets({ BETTER_AUTH_SECRET: SECRET_32, ENCRYPTION_KEYS: K1 }, fakeGen());
    expect(keep.values.BETTER_AUTH_SECRET).toBe(SECRET_32);
    expect(keep.generated).toEqual([]);

    const gen = fakeGen();
    const regen = resolveSecrets({ BETTER_AUTH_SECRET: SECRET_31, ENCRYPTION_KEYS: K1 }, gen);
    expect(regen.values.BETTER_AUTH_SECRET).toBe(gen.secret.mock.results[0].value);
    expect(regen.values.BETTER_AUTH_SECRET).not.toBe(SECRET_31);
    expect(regen.generated).toEqual(['BETTER_AUTH_SECRET']);
  });

  it('only lists ENCRYPTION_KEYS when only the keys are missing', () => {
    const gen = fakeGen();
    const result = resolveSecrets({ BETTER_AUTH_SECRET: SECRET_32 }, gen);
    expect(result.values.BETTER_AUTH_SECRET).toBe(SECRET_32);
    expect(result.values.ENCRYPTION_KEYS).toBe(keyOf('v1', 9));
    expect(result.generated).toEqual(['ENCRYPTION_KEYS']);
    expect(gen.secret).not.toHaveBeenCalled();
  });

  it.each([
    ['garbage'],
    ['v1:short'],
    [`v1:${'A'.repeat(44)}`],
    [`x1:${Buffer.alloc(32, 1).toString('base64')}`],
    [`v1${Buffer.alloc(32, 1).toString('base64')}`],
    [''],
  ])('regenerates malformed ENCRYPTION_KEYS %j', (keys) => {
    const gen = fakeGen();
    const result = resolveSecrets({ BETTER_AUTH_SECRET: SECRET_32, ENCRYPTION_KEYS: keys }, gen);
    expect(result.values.ENCRYPTION_KEYS).toBe(keyOf('v1', 9));
    expect(result.values.ENCRYPTION_KEY_CURRENT).toBe('v1');
    expect(result.generated).toEqual(['ENCRYPTION_KEYS']);
    expect(gen.encryptionKey).toHaveBeenCalledTimes(1);
  });

  it('never replaces a valid multi-key ENCRYPTION_KEYS', () => {
    const gen = fakeGen();
    const result = resolveSecrets(
      { BETTER_AUTH_SECRET: SECRET_32, ENCRYPTION_KEYS: `${K1},${K2}` },
      gen
    );
    expect(result.values.ENCRYPTION_KEYS).toBe(`${K1},${K2}`);
    expect(result.generated).toEqual([]);
    expect(gen.encryptionKey).not.toHaveBeenCalled();
  });

  it('defaults the current key to the last entry when previous is empty', () => {
    const result = resolveSecrets(
      { BETTER_AUTH_SECRET: SECRET_32, ENCRYPTION_KEYS: `${K1},${K2}` },
      fakeGen()
    );
    expect(result.values.ENCRYPTION_KEY_CURRENT).toBe('v2');
  });

  it('supports multi-digit versions for the last entry', () => {
    const K12 = keyOf('v12', 3);
    const result = resolveSecrets(
      { BETTER_AUTH_SECRET: SECRET_32, ENCRYPTION_KEYS: `${K2},${K12}` },
      fakeGen()
    );
    expect(result.values.ENCRYPTION_KEYS).toBe(`${K2},${K12}`);
    expect(result.values.ENCRYPTION_KEY_CURRENT).toBe('v12');
  });

  it('keeps a current key that names a present non-last version', () => {
    const result = resolveSecrets(
      {
        BETTER_AUTH_SECRET: SECRET_32,
        ENCRYPTION_KEYS: `${K1},${K2}`,
        ENCRYPTION_KEY_CURRENT: 'v1',
      },
      fakeGen()
    );
    expect(result.values.ENCRYPTION_KEY_CURRENT).toBe('v1');
    expect(result.generated).toEqual([]);
  });

  it('replaces a current key that names an absent version with the last one', () => {
    const result = resolveSecrets(
      {
        BETTER_AUTH_SECRET: SECRET_32,
        ENCRYPTION_KEYS: `${K1},${K2}`,
        ENCRYPTION_KEY_CURRENT: 'v9',
      },
      fakeGen()
    );
    expect(result.values.ENCRYPTION_KEY_CURRENT).toBe('v2');
    expect(result.generated).toEqual([]);
  });

  it('does not match a version by prefix (v1 is not v12)', () => {
    const K12 = keyOf('v12', 3);
    const result = resolveSecrets(
      {
        BETTER_AUTH_SECRET: SECRET_32,
        ENCRYPTION_KEYS: `${K12},${K2}`,
        ENCRYPTION_KEY_CURRENT: 'v1',
      },
      fakeGen()
    );
    expect(result.values.ENCRYPTION_KEY_CURRENT).toBe('v2');
  });

  it('uses v1 when keys were generated and the previous current is stale', () => {
    const result = resolveSecrets(
      { BETTER_AUTH_SECRET: SECRET_32, ENCRYPTION_KEY_CURRENT: 'v3' },
      fakeGen()
    );
    expect(result.values.ENCRYPTION_KEY_CURRENT).toBe('v1');
    expect(result.generated).toEqual(['ENCRYPTION_KEYS']);
  });

  it('never lists ENCRYPTION_KEY_CURRENT in generated', () => {
    const result = resolveSecrets(
      {
        BETTER_AUTH_SECRET: SECRET_32,
        ENCRYPTION_KEYS: K1,
        ENCRYPTION_KEY_CURRENT: '',
      },
      fakeGen()
    );
    expect(result.values.ENCRYPTION_KEY_CURRENT).toBe('v1');
    expect(result.generated).toEqual([]);
  });

  it('uses the real generators by default', () => {
    const result = resolveSecrets({});
    expect(result.values.BETTER_AUTH_SECRET).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(result.values.ENCRYPTION_KEYS).toMatch(KEY_RE);
    expect(result.values.ENCRYPTION_KEYS.startsWith('v1:')).toBe(true);
    expect(result.values.ENCRYPTION_KEY_CURRENT).toBe('v1');
    expect(result.generated).toEqual(['BETTER_AUTH_SECRET', 'ENCRYPTION_KEYS']);
  });

  it('is idempotent: resolving its own output generates nothing', () => {
    const first = resolveSecrets({});
    const gen = fakeGen();
    const second = resolveSecrets(first.values, gen);
    expect(second).toEqual({ values: first.values, generated: [] });
    expect(gen.secret).not.toHaveBeenCalled();
    expect(gen.encryptionKey).not.toHaveBeenCalled();
  });
});

describe('composeApiEnv', () => {
  it('writes only comments, KEY=value lines or blank lines, ending with a newline', () => {
    const body = composeApiEnv({
      infra: INFRA,
      previous: {},
      secrets: SECRETS,
    });
    expect(body.endsWith('\n')).toBe(true);
    for (const line of body.split('\n')) {
      expect(line).toMatch(/^(|#.*|[A-Za-z_][A-Za-z0-9_]*=.*)$/);
    }
  });

  it('rewrites the infra keys from the ports', () => {
    expect(apiEnvOf()).toMatchObject({
      DATABASE_URL: 'postgresql://parle:parle@127.0.0.1:5544/parle',
      SMTP_URL: 'smtp://127.0.0.1:2025',
      PORT: '4001',
      BETTER_AUTH_URL: 'http://localhost:4001',
      WEB_URL: 'http://localhost:4000',
      CORS_ORIGINS: 'http://localhost:4000',
      MAIL_FROM: 'parle-tcf <no-reply@parle-tcf.local>',
    });
  });

  it('overrides stale infra values from previous', () => {
    const env = apiEnvOf({
      DATABASE_URL: 'postgresql://old:old@db:5432/old',
      SMTP_URL: 'smtp://old:25',
      PORT: '9999',
      BETTER_AUTH_URL: 'http://old:9999',
      WEB_URL: 'http://old:9998',
      CORS_ORIGINS: 'http://old:9998',
      MAIL_FROM: 'old <old@old>',
    });
    expect(env.DATABASE_URL).toBe('postgresql://parle:parle@127.0.0.1:5544/parle');
    expect(env.SMTP_URL).toBe('smtp://127.0.0.1:2025');
    expect(env.PORT).toBe('4001');
    expect(env.BETTER_AUTH_URL).toBe('http://localhost:4001');
    expect(env.WEB_URL).toBe('http://localhost:4000');
    expect(env.CORS_ORIGINS).toBe('http://localhost:4000');
    expect(env.MAIL_FROM).toBe('parle-tcf <no-reply@parle-tcf.local>');
  });

  it('writes the secrets verbatim, ignoring previous secret values', () => {
    const env = apiEnvOf({
      BETTER_AUTH_SECRET: 'previous-secret'.padEnd(40, 'p'),
      ENCRYPTION_KEYS: keyOf('v7', 7),
      ENCRYPTION_KEY_CURRENT: 'v7',
    });
    expect(env.BETTER_AUTH_SECRET).toBe(SECRETS.BETTER_AUTH_SECRET);
    expect(env.ENCRYPTION_KEYS).toBe(SECRETS.ENCRYPTION_KEYS);
    expect(env.ENCRYPTION_KEY_CURRENT).toBe('v2');
  });

  it('writes operator defaults when previous is empty', () => {
    expect(apiEnvOf()).toMatchObject({
      AUTH_EMAIL_VERIFICATION_ENABLED: 'true',
      GITHUB_CLIENT_ID: '',
      GITHUB_CLIENT_SECRET: '',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      DEFAULT_DAILY_MINUTES: '60',
      DEFAULT_MONTHLY_COST_USD: '10',
    });
  });

  it('preserves operator keys from previous', () => {
    expect(
      apiEnvOf({
        AUTH_EMAIL_VERIFICATION_ENABLED: 'false',
        GITHUB_CLIENT_ID: 'gh-id',
        GITHUB_CLIENT_SECRET: 'gh-secret',
        GOOGLE_CLIENT_ID: 'g-id',
        GOOGLE_CLIENT_SECRET: 'g-secret',
        DEFAULT_DAILY_MINUTES: '15',
        DEFAULT_MONTHLY_COST_USD: '25',
      })
    ).toMatchObject({
      AUTH_EMAIL_VERIFICATION_ENABLED: 'false',
      GITHUB_CLIENT_ID: 'gh-id',
      GITHUB_CLIENT_SECRET: 'gh-secret',
      GOOGLE_CLIENT_ID: 'g-id',
      GOOGLE_CLIENT_SECRET: 'g-secret',
      DEFAULT_DAILY_MINUTES: '15',
      DEFAULT_MONTHLY_COST_USD: '25',
    });
  });

  it.each([
    ['true', 'true'],
    ['false', 'false'],
    ['yes', 'true'],
    ['1', 'true'],
    ['0', 'true'],
    ['FALSE', 'true'],
    ['', 'true'],
  ])('maps AUTH_EMAIL_VERIFICATION_ENABLED=%j to %j', (previousValue, expected) => {
    expect(
      apiEnvOf({ AUTH_EMAIL_VERIFICATION_ENABLED: previousValue }).AUTH_EMAIL_VERIFICATION_ENABLED
    ).toBe(expected);
  });

  it('always writes the local S3 storage keys, even when previous is empty', () => {
    expect(apiEnvOf()).toMatchObject(LOCAL_S3);
  });

  it('derives the S3 keys from devStorage(infra)', () => {
    const storage = devStorage(INFRA);
    expect(apiEnvOf()).toMatchObject({
      S3_BUCKET: storage.bucket,
      S3_ENDPOINT: storage.endpoint,
      S3_REGION: storage.region,
      S3_ACCESS_KEY_ID: storage.accessKeyId,
      S3_SECRET_ACCESS_KEY: storage.secretAccessKey,
      S3_FORCE_PATH_STYLE: String(storage.forcePathStyle),
    });
  });

  it('overrides stale S3 values from previous', () => {
    expect(apiEnvOf(STALE_S3)).toMatchObject(LOCAL_S3);
  });

  it('writes each S3 key exactly once, with or without previous values', () => {
    for (const previous of [{}, STALE_S3, LOCAL_S3]) {
      const body = composeApiEnv({ infra: INFRA, previous, secrets: SECRETS });
      for (const key of S3_KEYS) {
        expect(countKey(body, key), `${key} with ${JSON.stringify(previous)}`).toBe(1);
      }
    }
  });

  it('follows the storage port, not the console port', () => {
    const env = parseDotenv(
      composeApiEnv({
        infra: { ...INFRA, storagePort: 9777, storageConsolePort: 9778 },
        previous: {},
        secrets: SECRETS,
      })
    );
    expect(env.S3_ENDPOINT).toBe('http://127.0.0.1:9777');
  });

  it('omits optional keys that are absent or empty', () => {
    const absent = apiEnvOf();
    const empty = apiEnvOf(Object.fromEntries(OPTIONAL_KEYS.map((key) => [key, ''])));
    for (const key of OPTIONAL_KEYS) {
      expect(absent).not.toHaveProperty(key);
      expect(empty).not.toHaveProperty(key);
    }
  });

  it('copies every optional key that is present and non-empty', () => {
    const previous = {
      OPENAI_REALTIME_MODEL: 'gpt-realtime-mini',
      RESEND_API_KEY: 're_123',
    };
    expect(apiEnvOf(previous)).toMatchObject(previous);
  });

  it('copies each optional key exactly once', () => {
    const body = composeApiEnv({
      infra: INFRA,
      previous: { OPENAI_REALTIME_MODEL: 'gpt-realtime-mini', RESEND_API_KEY: 're_123' },
      secrets: SECRETS,
    });
    for (const key of OPTIONAL_KEYS) {
      expect(countKey(body, key)).toBe(1);
    }
  });

  it('copies one optional key without inventing the others', () => {
    const env = apiEnvOf({ RESEND_API_KEY: 're_only' });
    expect(env.RESEND_API_KEY).toBe('re_only');
    for (const key of OPTIONAL_KEYS.filter((k) => k !== 'RESEND_API_KEY')) {
      expect(env).not.toHaveProperty(key);
    }
  });

  it('keeps optional keys alongside the local S3 keys', () => {
    expect(apiEnvOf({ ...STALE_S3, RESEND_API_KEY: 're_123' })).toMatchObject({
      ...LOCAL_S3,
      RESEND_API_KEY: 're_123',
    });
  });

  it('drops unknown keys from previous', () => {
    const env = apiEnvOf({ FOO: 'bar', NEXT_PUBLIC_EXAM_API_URL: 'x' });
    expect(env).not.toHaveProperty('FOO');
    expect(env).not.toHaveProperty('NEXT_PUBLIC_EXAM_API_URL');
  });

  it('never mentions NEXT_PUBLIC_', () => {
    const body = composeApiEnv({
      infra: INFRA,
      previous: { NEXT_PUBLIC_MAILPIT_URL: 'http://x', GITHUB_CLIENT_ID: 'a' },
      secrets: SECRETS,
    });
    expect(body).not.toContain('NEXT_PUBLIC_');
  });

  it('is stable when fed its own output as previous', () => {
    const previous = {
      AUTH_EMAIL_VERIFICATION_ENABLED: 'false',
      GITHUB_CLIENT_ID: 'gh-id',
      GITHUB_CLIENT_SECRET: 'gh-secret',
      DEFAULT_DAILY_MINUTES: '15',
      S3_BUCKET: 'recordings',
      RESEND_API_KEY: 're_123',
    };
    const first = apiEnvOf(previous);
    expect(first.S3_BUCKET).toBe('parle-tcf-audio');
    expect(apiEnvOf(first)).toEqual(first);
    const body = composeApiEnv({ infra: INFRA, previous: first, secrets: SECRETS });
    expect(body).toBe(composeApiEnv({ infra: INFRA, previous: apiEnvOf(first), secrets: SECRETS }));
  });

  it('uses devInfra defaults end to end', () => {
    const env = parseDotenv(composeApiEnv({ infra: devInfra({}), previous: {}, secrets: SECRETS }));
    expect(env.DATABASE_URL).toBe('postgresql://parle:parle@127.0.0.1:5432/parle');
    expect(env.SMTP_URL).toBe('smtp://127.0.0.1:1025');
    expect(env.PORT).toBe('3001');
    expect(env.WEB_URL).toBe('http://localhost:3000');
    expect(env.S3_ENDPOINT).toBe('http://127.0.0.1:9000');
  });
});

describe('composeWebEnv', () => {
  const webEnvOf = (previous = {}) =>
    parseDotenv(composeWebEnv({ infra: INFRA, apiEnv: apiEnvOf(previous) }));

  it('writes exactly the public keys', () => {
    expect(webEnvOf()).toEqual({
      NEXT_PUBLIC_EXAM_API_URL: 'http://localhost:4001',
      NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED: 'false',
      NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED: 'false',
      NEXT_PUBLIC_MAILPIT_URL: 'http://localhost:9025',
    });
  });

  it('ends with a newline', () => {
    expect(composeWebEnv({ infra: INFRA, apiEnv: apiEnvOf() }).endsWith('\n')).toBe(true);
  });

  it('enables GitHub only when both id and secret are set', () => {
    expect(webEnvOf({ GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret' })).toMatchObject({
      NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED: 'true',
      NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED: 'false',
    });
    expect(webEnvOf({ GITHUB_CLIENT_ID: 'id' }).NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED).toBe(
      'false'
    );
    expect(webEnvOf({ GITHUB_CLIENT_SECRET: 'secret' }).NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED).toBe(
      'false'
    );
  });

  it('enables Google only when both id and secret are set', () => {
    expect(webEnvOf({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })).toMatchObject({
      NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED: 'false',
      NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED: 'true',
    });
    expect(webEnvOf({ GOOGLE_CLIENT_ID: 'id' }).NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED).toBe(
      'false'
    );
    expect(webEnvOf({ GOOGLE_CLIENT_SECRET: 'secret' }).NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED).toBe(
      'false'
    );
  });

  it('reads the flags from apiEnv directly', () => {
    const env = parseDotenv(
      composeWebEnv({
        infra: INFRA,
        apiEnv: {
          GITHUB_CLIENT_ID: 'a',
          GITHUB_CLIENT_SECRET: 'b',
          GOOGLE_CLIENT_ID: 'c',
          GOOGLE_CLIENT_SECRET: 'd',
        },
      })
    );
    expect(env.NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED).toBe('true');
    expect(env.NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED).toBe('true');
  });

  it('never leaks secrets or secret key names', () => {
    const apiEnv = apiEnvOf({
      GITHUB_CLIENT_ID: 'gh-id-value',
      GITHUB_CLIENT_SECRET: 'gh-secret-value',
      GOOGLE_CLIENT_ID: 'g-id-value',
      GOOGLE_CLIENT_SECRET: 'g-secret-value',
    });
    const body = composeWebEnv({ infra: INFRA, apiEnv });
    for (const needle of [
      SECRETS.BETTER_AUTH_SECRET,
      K1,
      K2,
      'gh-secret-value',
      'g-secret-value',
      'parle-dev-secret',
      'S3_SECRET_ACCESS_KEY',
      'BETTER_AUTH_SECRET',
      'ENCRYPTION_KEYS',
      'DATABASE_URL',
      'CLIENT_SECRET',
    ]) {
      expect(body).not.toContain(needle);
    }
  });
});
