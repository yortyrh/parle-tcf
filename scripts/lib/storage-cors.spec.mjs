import { describe, expect, it } from 'vitest';
import { corsMatches, corsRulesFor, storageTargetFromEnv } from './storage-cors.mjs';

const REQUIRED = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'CORS_ORIGINS'];

const validEnv = () => ({
  S3_BUCKET: 'audio-bucket',
  S3_ACCESS_KEY_ID: 'key-id-value',
  S3_SECRET_ACCESS_KEY: 'secret-value-xyz',
  CORS_ORIGINS: 'https://web.example.com',
});

const errorMessage = (fn) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return error.message;
  }
  throw new Error('expected the call to throw');
};

const rule = (overrides = {}) => ({
  AllowedOrigins: ['https://a.com', 'https://b.com'],
  AllowedMethods: ['GET', 'POST'],
  AllowedHeaders: ['*'],
  MaxAgeSeconds: 3000,
  ...overrides,
});

describe('corsRulesFor', () => {
  it('builds a single GET/POST rule for the given origin', () => {
    expect(corsRulesFor(['https://web.example.com'])).toEqual([
      {
        AllowedOrigins: ['https://web.example.com'],
        AllowedMethods: ['GET', 'POST'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 3000,
      },
    ]);
  });

  it('keeps several origins in order, in one rule', () => {
    const rules = corsRulesFor(['https://b.com', 'https://a.com']);
    expect(rules).toHaveLength(1);
    expect(rules[0].AllowedOrigins).toEqual(['https://b.com', 'https://a.com']);
  });

  it('copies the origins instead of keeping the caller array', () => {
    const origins = ['https://a.com'];
    const [built] = corsRulesFor(origins);
    expect(built.AllowedOrigins).not.toBe(origins);
    origins.push('https://evil.com');
    expect(built.AllowedOrigins).toEqual(['https://a.com']);
  });

  it('never allows a wildcard origin, PUT or DELETE', () => {
    const [built] = corsRulesFor(['https://a.com']);
    expect(built.AllowedOrigins).not.toContain('*');
    expect(built.AllowedMethods).not.toContain('PUT');
    expect(built.AllowedMethods).not.toContain('DELETE');
  });

  it('throws when there is no origin', () => {
    expect(errorMessage(() => corsRulesFor([]))).toMatch(/origin/i);
  });
});

describe('storageTargetFromEnv', () => {
  it('reads the bucket, credentials and origins', () => {
    expect(
      storageTargetFromEnv({
        ...validEnv(),
        S3_ENDPOINT: 'https://storage.example.com',
        S3_REGION: 'eu-west-1',
        S3_FORCE_PATH_STYLE: 'true',
      })
    ).toEqual({
      bucket: 'audio-bucket',
      endpoint: 'https://storage.example.com',
      region: 'eu-west-1',
      accessKeyId: 'key-id-value',
      secretAccessKey: 'secret-value-xyz',
      forcePathStyle: true,
      origins: ['https://web.example.com'],
    });
  });

  it('trims every value', () => {
    const target = storageTargetFromEnv({
      S3_BUCKET: '  audio-bucket ',
      S3_ACCESS_KEY_ID: ' key-id-value\n',
      S3_SECRET_ACCESS_KEY: '\tsecret-value-xyz ',
      S3_ENDPOINT: ' https://storage.example.com ',
      S3_REGION: ' eu-west-1 ',
      CORS_ORIGINS: ' https://web.example.com ',
    });
    expect(target.bucket).toBe('audio-bucket');
    expect(target.accessKeyId).toBe('key-id-value');
    expect(target.secretAccessKey).toBe('secret-value-xyz');
    expect(target.endpoint).toBe('https://storage.example.com');
    expect(target.region).toBe('eu-west-1');
    expect(target.origins).toEqual(['https://web.example.com']);
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('leaves the endpoint undefined when S3_ENDPOINT is %s', (_name, value) => {
    expect(storageTargetFromEnv({ ...validEnv(), S3_ENDPOINT: value }).endpoint).toBeUndefined();
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('defaults the region to auto when S3_REGION is %s', (_name, value) => {
    expect(storageTargetFromEnv({ ...validEnv(), S3_REGION: value }).region).toBe('auto');
  });

  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
    ['', false],
    [undefined, false],
  ])('forcePathStyle for S3_FORCE_PATH_STYLE=%s is %s', (value, expected) => {
    expect(storageTargetFromEnv({ ...validEnv(), S3_FORCE_PATH_STYLE: value }).forcePathStyle).toBe(
      expected
    );
  });

  it('splits and normalizes CORS_ORIGINS like the deploy checks', () => {
    const target = storageTargetFromEnv({ ...validEnv(), CORS_ORIGINS: 'https://a.com/, b.com' });
    expect(target.origins).toEqual(['https://a.com', 'https://b.com']);
  });

  it('drops blank origins and keeps http origins', () => {
    const target = storageTargetFromEnv({
      ...validEnv(),
      CORS_ORIGINS: ' , http://localhost:3000//, ,web.example.com,',
    });
    expect(target.origins).toEqual(['http://localhost:3000', 'https://web.example.com']);
  });

  it.each(REQUIRED)('throws naming %s when it is unset, and only that key', (key) => {
    const env = validEnv();
    delete env[key];
    const message = errorMessage(() => storageTargetFromEnv(env));
    expect(message).toContain(key);
    for (const other of REQUIRED.filter((k) => k !== key)) {
      expect(message).not.toContain(other);
    }
  });

  it.each(REQUIRED)('treats a whitespace-only %s as missing', (key) => {
    const message = errorMessage(() => storageTargetFromEnv({ ...validEnv(), [key]: '   ' }));
    expect(message).toContain(key);
  });

  it('treats CORS_ORIGINS made only of commas and blanks as missing', () => {
    const message = errorMessage(() =>
      storageTargetFromEnv({ ...validEnv(), CORS_ORIGINS: ' , ,, ' })
    );
    expect(message).toContain('CORS_ORIGINS');
  });

  it('names every missing key at once', () => {
    const message = errorMessage(() => storageTargetFromEnv({}));
    for (const key of REQUIRED) expect(message).toContain(key);
  });

  it('names two missing keys together', () => {
    const env = validEnv();
    delete env.S3_BUCKET;
    const message = errorMessage(() => storageTargetFromEnv({ ...env, CORS_ORIGINS: '' }));
    expect(message).toContain('S3_BUCKET');
    expect(message).toContain('CORS_ORIGINS');
    expect(message).not.toContain('S3_ACCESS_KEY_ID');
    expect(message).not.toContain('S3_SECRET_ACCESS_KEY');
  });

  it('lists the missing keys separated by ", "', () => {
    const message = errorMessage(() =>
      storageTargetFromEnv({ CORS_ORIGINS: 'https://web.example.com', S3_SECRET_ACCESS_KEY: 's' })
    );
    expect(message).toContain('S3_BUCKET, S3_ACCESS_KEY_ID');
  });

  it('lists all four missing keys in order, separated by ", "', () => {
    const message = errorMessage(() => storageTargetFromEnv({}));
    expect(message).toContain('S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, CORS_ORIGINS');
  });

  it('never puts secret values in the error message', () => {
    const env = validEnv();
    delete env.S3_BUCKET;
    const message = errorMessage(() => storageTargetFromEnv(env));
    expect(message).not.toContain('secret-value-xyz');
    expect(message).not.toContain('key-id-value');
  });

  it('does not require the optional keys', () => {
    expect(() => storageTargetFromEnv(validEnv())).not.toThrow();
  });
});

describe('corsMatches', () => {
  it('matches identical rules', () => {
    expect(corsMatches([rule()], [rule()])).toBe(true);
  });

  it('ignores extra fields added by the provider', () => {
    expect(corsMatches([{ ID: '', ...rule(), ExposeHeaders: undefined }], [rule()])).toBe(true);
  });

  it('ignores the order inside each list', () => {
    const applied = rule({
      AllowedOrigins: ['https://b.com', 'https://a.com'],
      AllowedMethods: ['POST', 'GET'],
    });
    expect(corsMatches([applied], [rule()])).toBe(true);
  });

  it('matches several rules in the same order', () => {
    const expected = [rule(), rule({ AllowedOrigins: ['https://c.com'], MaxAgeSeconds: 60 })];
    expect(corsMatches(structuredClone(expected), expected)).toBe(true);
  });

  it('does not match the same rules in another order', () => {
    const first = rule();
    const second = rule({ AllowedOrigins: ['https://c.com'] });
    expect(corsMatches([second, first], [first, second])).toBe(false);
  });

  it('does not match when only the first of two rules matches', () => {
    const first = rule();
    const second = rule({ AllowedOrigins: ['https://c.com'] });
    expect(corsMatches([first, rule({ AllowedOrigins: ['https://x.com'] })], [first, second])).toBe(
      false
    );
  });

  it('does not match when only the second of two rules matches', () => {
    const first = rule();
    const second = rule({ AllowedOrigins: ['https://c.com'] });
    expect(corsMatches([rule({ MaxAgeSeconds: 1 }), second], [first, second])).toBe(false);
  });

  it.each([
    ['a missing origin', { AllowedOrigins: ['https://a.com'] }],
    ['an extra origin', { AllowedOrigins: ['https://a.com', 'https://b.com', 'https://c.com'] }],
    ['a different origin', { AllowedOrigins: ['https://a.com', 'https://x.com'] }],
    ['a wildcard origin', { AllowedOrigins: ['*'] }],
    ['a missing method', { AllowedMethods: ['GET'] }],
    ['an extra method', { AllowedMethods: ['GET', 'POST', 'PUT'] }],
    ['a duplicated method instead of another', { AllowedMethods: ['GET', 'GET'] }],
    ['a missing header', { AllowedHeaders: [] }],
    ['an extra header', { AllowedHeaders: ['*', 'content-type'] }],
    ['a different header', { AllowedHeaders: ['content-type'] }],
    ['a different MaxAgeSeconds', { MaxAgeSeconds: 3001 }],
    ['no MaxAgeSeconds', { MaxAgeSeconds: undefined }],
    ['no AllowedHeaders', { AllowedHeaders: undefined }],
    ['no AllowedOrigins', { AllowedOrigins: undefined }],
    ['no AllowedMethods', { AllowedMethods: undefined }],
  ])('does not match %s', (_name, overrides) => {
    expect(corsMatches([rule(overrides)], [rule()])).toBe(false);
  });

  it('does not match when the expected rule has an origin the applied one lacks', () => {
    const expected = [
      rule({ AllowedOrigins: ['https://a.com', 'https://b.com', 'https://c.com'] }),
    ];
    expect(corsMatches([rule()], expected)).toBe(false);
  });

  it('does not match an extra applied rule', () => {
    expect(corsMatches([rule(), rule()], [rule()])).toBe(false);
  });

  it('does not match a missing applied rule', () => {
    expect(corsMatches([rule()], [rule(), rule()])).toBe(false);
  });

  it('does not match an empty rule list', () => {
    expect(corsMatches([], [rule()])).toBe(false);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an object', { CORSRules: [rule()] }],
    ['a string', 'rules'],
  ])('does not match when applied is %s', (_name, applied) => {
    expect(corsMatches(applied, [rule()])).toBe(false);
  });

  it('matches what corsRulesFor builds', () => {
    const expected = corsRulesFor(['https://web.example.com']);
    expect(corsMatches([{ ID: '', ...expected[0] }], expected)).toBe(true);
  });
});
