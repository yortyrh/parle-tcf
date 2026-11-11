import { describe, expect, it } from 'vitest';
import {
  checkApiVariables,
  checkConsistency,
  checkWebVariables,
  deploymentOutcome,
  formatProblems,
  normalizeUrl,
  parseKv,
  parseOrigins,
  pickPublicUrl,
  servicesFor,
} from './deploy.mjs';

const KEY = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=';

const validApi = () => ({
  DATABASE_URL: 'postgres://u:p@db:5432/app',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'https://api.example.com',
  WEB_URL: 'https://web.example.com',
  CORS_ORIGINS: 'https://web.example.com',
  ENCRYPTION_KEYS: `v1:${KEY}`,
  ENCRYPTION_KEY_CURRENT: 'v1',
  RESEND_API_KEY: 're_123',
  MAIL_FROM: 'parle-tcf <no-reply@example.com>',
});

const messages = (problems) => problems.map((p) => p.message);
const hasMessage = (problems, text) => messages(problems).some((m) => m.includes(text));

describe('parseKv', () => {
  it('parses KEY=value lines', () => {
    expect(parseKv('A=1\nB=two')).toEqual({ A: '1', B: 'two' });
  });

  it('keeps "=" inside values', () => {
    expect(parseKv('SECRET=abc==\nURL=http://x/?a=b')).toEqual({
      SECRET: 'abc==',
      URL: 'http://x/?a=b',
    });
  });

  it('skips blank lines and lines without a key', () => {
    expect(parseKv('\nnoequals\n=novalue\nA=1\n')).toEqual({ A: '1' });
  });

  it('trims keys and values', () => {
    expect(parseKv('  A  =  1  ')).toEqual({ A: '1' });
  });

  it('allows empty values', () => {
    expect(parseKv('A=')).toEqual({ A: '' });
  });

  it('returns an empty object for empty text', () => {
    expect(parseKv('')).toEqual({});
  });
});

describe('normalizeUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeUrl('https://a.com/')).toBe('https://a.com');
    expect(normalizeUrl('https://a.com///')).toBe('https://a.com');
  });

  it('adds https:// to bare hosts', () => {
    expect(normalizeUrl('a.com')).toBe('https://a.com');
    expect(normalizeUrl('a.com/')).toBe('https://a.com');
  });

  it('keeps http and https schemes, case-insensitively', () => {
    expect(normalizeUrl('http://a.com')).toBe('http://a.com');
    expect(normalizeUrl('HTTPS://a.com')).toBe('HTTPS://a.com');
  });

  it('keeps paths', () => {
    expect(normalizeUrl('https://a.com/x/')).toBe('https://a.com/x');
  });

  it('trims whitespace', () => {
    expect(normalizeUrl('  a.com  ')).toBe('https://a.com');
  });

  it('returns empty string for empty, blank, slash-only or missing input', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('   ')).toBe('');
    expect(normalizeUrl('/')).toBe('');
    expect(normalizeUrl(undefined)).toBe('');
    expect(normalizeUrl(null)).toBe('');
  });
});

describe('parseOrigins', () => {
  it('splits and normalizes a comma list', () => {
    expect(parseOrigins('https://a.com/, b.com ,http://c.com')).toEqual([
      'https://a.com',
      'https://b.com',
      'http://c.com',
    ]);
  });

  it('drops empty entries', () => {
    expect(parseOrigins('a.com,, ,')).toEqual(['https://a.com']);
  });

  it('returns [] for empty or missing input', () => {
    expect(parseOrigins('')).toEqual([]);
    expect(parseOrigins(undefined)).toEqual([]);
  });
});

describe('pickPublicUrl', () => {
  it('prefers a custom domain over others regardless of order', () => {
    const list = {
      domains: [
        { type: 'service', domain: 'x.up.railway.app' },
        { type: 'custom', domain: 'app.example.com' },
      ],
    };
    expect(pickPublicUrl(list)).toBe('https://app.example.com');
  });

  it('falls back to the first domain when none is custom', () => {
    const list = {
      domains: [
        { type: 'service', domain: 'x.up.railway.app' },
        { type: 'service', domain: 'y.up.railway.app' },
      ],
    };
    expect(pickPublicUrl(list)).toBe('https://x.up.railway.app');
  });

  it('normalizes the chosen domain', () => {
    expect(pickPublicUrl({ domains: [{ type: 'custom', domain: 'https://a.com/' }] })).toBe(
      'https://a.com'
    );
  });

  it('returns empty string when there are no domains', () => {
    expect(pickPublicUrl({ domains: [] })).toBe('');
    expect(pickPublicUrl({})).toBe('');
    expect(pickPublicUrl(undefined)).toBe('');
    expect(pickPublicUrl(null)).toBe('');
  });
});

describe('checkApiVariables', () => {
  it('reports nothing for a fully valid set', () => {
    expect(checkApiVariables(validApi())).toEqual([]);
  });

  it('accepts SMTP_URL instead of RESEND_API_KEY', () => {
    const vars = { ...validApi(), RESEND_API_KEY: undefined, SMTP_URL: 'smtp://mail:25' };
    expect(checkApiVariables(vars)).toEqual([]);
  });

  it('accepts several encryption keys with the current one listed', () => {
    const vars = {
      ...validApi(),
      ENCRYPTION_KEYS: `v1:${KEY}, v2:${KEY}`,
      ENCRYPTION_KEY_CURRENT: 'v2',
    };
    expect(checkApiVariables(vars)).toEqual([]);
  });

  it('shapes every problem as { service: "api", message, fix }', () => {
    const problems = checkApiVariables({});
    expect(problems.length).toBeGreaterThan(0);
    for (const p of problems) {
      expect(p.service).toBe('api');
      expect(p.message).toEqual(expect.any(String));
      expect(p.fix).toEqual(expect.any(String));
      expect(p.message).not.toBe('');
      expect(p.fix).not.toBe('');
    }
  });

  it.each([
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'WEB_URL',
    'CORS_ORIGINS',
    'ENCRYPTION_KEYS',
    'ENCRYPTION_KEY_CURRENT',
    'MAIL_FROM',
  ])('flags %s when missing', (key) => {
    const vars = validApi();
    delete vars[key];
    const problems = checkApiVariables(vars);
    expect(problems.filter((p) => p.message.includes(key))).not.toHaveLength(0);
    expect(problems.length).toBeGreaterThan(0);
  });

  it.each([
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'WEB_URL',
    'CORS_ORIGINS',
    'ENCRYPTION_KEYS',
    'ENCRYPTION_KEY_CURRENT',
    'MAIL_FROM',
  ])('treats a whitespace-only %s as unset', (key) => {
    const vars = { ...validApi(), [key]: '   ' };
    expect(hasMessage(checkApiVariables(vars), key)).toBe(true);
  });

  it('flags only the missing variable', () => {
    const vars = validApi();
    delete vars.DATABASE_URL;
    const problems = checkApiVariables(vars);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('DATABASE_URL');
  });

  describe('BETTER_AUTH_SECRET length', () => {
    it('flags 31 characters', () => {
      const problems = checkApiVariables({ ...validApi(), BETTER_AUTH_SECRET: 'a'.repeat(31) });
      expect(problems).toHaveLength(1);
      expect(problems[0].message).toContain('BETTER_AUTH_SECRET');
      expect(problems[0].message).toContain('32');
    });

    it('accepts exactly 32 characters', () => {
      expect(checkApiVariables({ ...validApi(), BETTER_AUTH_SECRET: 'a'.repeat(32) })).toEqual([]);
    });

    it('accepts 33 characters', () => {
      expect(checkApiVariables({ ...validApi(), BETTER_AUTH_SECRET: 'a'.repeat(33) })).toEqual([]);
    });
  });

  describe('ENCRYPTION_KEYS format', () => {
    it.each([
      ['no version', KEY],
      ['empty base64', 'v1:'],
      ['empty version', `:${KEY}`],
      ['invalid base64 characters', 'v1:ab!cd'],
      ['too much padding', 'v1:abc==='],
      ['one bad entry among good ones', `v1:${KEY},oops`],
      ['trailing comma (empty entry)', `v1:${KEY},`],
    ])('flags %s', (_name, value) => {
      const problems = checkApiVariables({ ...validApi(), ENCRYPTION_KEYS: value });
      expect(hasMessage(problems, 'ENCRYPTION_KEYS')).toBe(true);
    });

    it('accepts base64url characters and padding', () => {
      const vars = { ...validApi(), ENCRYPTION_KEYS: 'v1:ab-c_d+e/f==' };
      expect(checkApiVariables(vars)).toEqual([]);
    });
  });

  describe('ENCRYPTION_KEY_CURRENT', () => {
    it('flags a version not listed in ENCRYPTION_KEYS', () => {
      const problems = checkApiVariables({ ...validApi(), ENCRYPTION_KEY_CURRENT: 'v2' });
      expect(problems).toHaveLength(1);
      expect(problems[0].message).toContain('ENCRYPTION_KEY_CURRENT');
    });

    it('does not accept a mere prefix of a listed version', () => {
      const vars = { ...validApi(), ENCRYPTION_KEYS: `v10:${KEY}`, ENCRYPTION_KEY_CURRENT: 'v1' };
      expect(hasMessage(checkApiVariables(vars), 'ENCRYPTION_KEY_CURRENT')).toBe(true);
    });

    it('does not report a mismatch when ENCRYPTION_KEYS is missing', () => {
      const vars = validApi();
      delete vars.ENCRYPTION_KEYS;
      const problems = checkApiVariables(vars);
      expect(problems).toHaveLength(1);
      expect(problems[0].message).toContain('ENCRYPTION_KEYS is not set');
    });
  });

  describe('mail transport', () => {
    it('flags the absence of both RESEND_API_KEY and SMTP_URL', () => {
      const vars = validApi();
      delete vars.RESEND_API_KEY;
      const problems = checkApiVariables(vars);
      expect(problems).toHaveLength(1);
      expect(problems[0].message).toContain('mail transport');
      expect(problems[0].fix).toContain('RESEND_API_KEY');
      expect(problems[0].fix).toContain('SMTP_URL');
    });

    it('treats whitespace-only values of both as unset', () => {
      const vars = { ...validApi(), RESEND_API_KEY: ' ', SMTP_URL: ' ' };
      expect(hasMessage(checkApiVariables(vars), 'mail transport')).toBe(true);
    });
  });

  describe('VOICE_PROVIDER', () => {
    it('flags fake', () => {
      const problems = checkApiVariables({ ...validApi(), VOICE_PROVIDER: 'fake' });
      expect(problems).toHaveLength(1);
      expect(problems[0].message).toContain('VOICE_PROVIDER=fake');
    });

    it.each(['real', 'openai', undefined])('accepts %s', (value) => {
      expect(checkApiVariables({ ...validApi(), VOICE_PROVIDER: value })).toEqual([]);
    });
  });
});

describe('checkWebVariables', () => {
  it('reports nothing when NEXT_PUBLIC_EXAM_API_URL is set', () => {
    expect(checkWebVariables({ NEXT_PUBLIC_EXAM_API_URL: 'https://api.example.com' })).toEqual([]);
  });

  it.each([{}, { NEXT_PUBLIC_EXAM_API_URL: '' }, { NEXT_PUBLIC_EXAM_API_URL: '  ' }])(
    'flags a missing or blank value (%j)',
    (vars) => {
      const problems = checkWebVariables(vars);
      expect(problems).toHaveLength(1);
      expect(problems[0].service).toBe('web');
      expect(problems[0].message).toContain('NEXT_PUBLIC_EXAM_API_URL');
      expect(problems[0].fix).not.toBe('');
    }
  );
});

describe('checkConsistency', () => {
  const API = 'https://api.example.com';
  const WEB = 'https://web.example.com';
  const consistent = () => ({
    apiVars: { BETTER_AUTH_URL: API, WEB_URL: WEB, CORS_ORIGINS: WEB },
    webVars: { NEXT_PUBLIC_EXAM_API_URL: API },
    apiUrl: API,
    webUrl: WEB,
  });

  it('reports nothing for consistent settings', () => {
    expect(checkConsistency(consistent())).toEqual([]);
  });

  it('tolerates trailing slashes and bare hosts in variables', () => {
    const input = consistent();
    input.apiVars = {
      BETTER_AUTH_URL: `${API}/`,
      WEB_URL: 'web.example.com/',
      CORS_ORIGINS: `${WEB}/`,
    };
    input.webVars = { NEXT_PUBLIC_EXAM_API_URL: `${API}/` };
    expect(checkConsistency(input)).toEqual([]);
  });

  it('flags a missing api domain on the api service', () => {
    const problems = checkConsistency({ ...consistent(), apiUrl: '' });
    expect(problems.filter((p) => p.message === 'no public domain')).toEqual([
      expect.objectContaining({ service: 'api' }),
    ]);
  });

  it('flags a missing web domain on the web service', () => {
    const problems = checkConsistency({ ...consistent(), webUrl: '' });
    expect(problems.filter((p) => p.message === 'no public domain')).toEqual([
      expect.objectContaining({ service: 'web' }),
    ]);
  });

  it('flags both missing domains without extra mismatch noise', () => {
    const problems = checkConsistency({ ...consistent(), apiUrl: '', webUrl: '' });
    expect(problems).toHaveLength(2);
    expect(problems.map((p) => p.service).sort()).toEqual(['api', 'web']);
  });

  it('flags BETTER_AUTH_URL different from the api URL', () => {
    const input = consistent();
    input.apiVars.BETTER_AUTH_URL = 'https://other.com';
    const problems = checkConsistency(input);
    expect(problems).toHaveLength(1);
    expect(problems[0].service).toBe('api');
    expect(problems[0].message).toContain('BETTER_AUTH_URL');
    expect(problems[0].fix).toContain(API);
  });

  it('flags WEB_URL different from the web URL', () => {
    const input = consistent();
    input.apiVars.WEB_URL = 'https://other.com';
    const problems = checkConsistency(input);
    expect(problems).toHaveLength(1);
    expect(problems[0].service).toBe('api');
    expect(problems[0].message).toContain('WEB_URL');
    expect(problems[0].fix).toContain(WEB);
  });

  it('flags NEXT_PUBLIC_EXAM_API_URL different from the api URL on the web service', () => {
    const input = consistent();
    input.webVars.NEXT_PUBLIC_EXAM_API_URL = 'https://other.com';
    const problems = checkConsistency(input);
    expect(problems).toHaveLength(1);
    expect(problems[0].service).toBe('web');
    expect(problems[0].message).toContain('NEXT_PUBLIC_EXAM_API_URL');
    expect(problems[0].fix).toContain(API);
  });

  it('flags CORS_ORIGINS that does not include the web URL', () => {
    const input = consistent();
    input.apiVars.CORS_ORIGINS = 'https://other.com';
    const problems = checkConsistency(input);
    expect(problems).toHaveLength(1);
    expect(problems[0].service).toBe('api');
    expect(problems[0].message).toContain('CORS_ORIGINS');
    expect(problems[0].fix).toContain(WEB);
  });

  it('accepts CORS_ORIGINS listing the web URL among others', () => {
    const input = consistent();
    input.apiVars.CORS_ORIGINS = `http://localhost:3000, ${WEB}/`;
    expect(checkConsistency(input)).toEqual([]);
  });

  it('does not flag variables that are unset (checked elsewhere)', () => {
    const problems = checkConsistency({
      apiVars: {},
      webVars: {},
      apiUrl: API,
      webUrl: WEB,
    });
    expect(problems).toEqual([]);
  });

  it('does not compare against a missing public URL', () => {
    const problems = checkConsistency({
      apiVars: {
        BETTER_AUTH_URL: 'https://x.com',
        WEB_URL: 'https://y.com',
        CORS_ORIGINS: 'z.com',
      },
      webVars: { NEXT_PUBLIC_EXAM_API_URL: 'https://x.com' },
      apiUrl: '',
      webUrl: '',
    });
    expect(problems.every((p) => p.message === 'no public domain')).toBe(true);
  });
});

describe('deploymentOutcome', () => {
  it('maps SUCCESS to ok', () => {
    expect(deploymentOutcome('SUCCESS')).toBe('ok');
  });

  it.each(['FAILED', 'CRASHED', 'REMOVED', 'SKIPPED'])('maps %s to failed', (status) => {
    expect(deploymentOutcome(status)).toBe('failed');
  });

  it.each(['BUILDING', 'DEPLOYING', 'INITIALIZING', 'QUEUED', 'WAITING', '', undefined])(
    'maps %s to pending',
    (status) => {
      expect(deploymentOutcome(status)).toBe('pending');
    }
  );
});

describe('servicesFor', () => {
  it('defaults to api then web', () => {
    expect(servicesFor()).toEqual(['api', 'web']);
  });

  it('returns both services in deploy order for "all"', () => {
    expect(servicesFor('all')).toEqual(['api', 'web']);
  });

  it('returns a single service', () => {
    expect(servicesFor('api')).toEqual(['api']);
    expect(servicesFor('web')).toEqual(['web']);
  });

  it('returns a fresh array each time', () => {
    const first = servicesFor('all');
    first.push('x');
    expect(servicesFor('all')).toEqual(['api', 'web']);
  });

  it.each(['db', '', 'API', 'api,web'])('throws on unknown target %j', (target) => {
    expect(() => servicesFor(target)).toThrow(/Unknown target/);
  });

  it('names the valid targets in the error', () => {
    expect(() => servicesFor('db')).toThrow(/"db"/);
    expect(() => servicesFor('db')).toThrow(/all, api, web/);
  });
});

describe('formatProblems', () => {
  it('includes service, message and fix', () => {
    const out = formatProblems([{ service: 'api', message: 'X is not set', fix: 'set X' }]);
    expect(out).toContain('[api]');
    expect(out).toContain('X is not set');
    expect(out).toContain('set X');
    expect(out.indexOf('X is not set')).toBeLessThan(out.indexOf('set X'));
  });

  it('lists every problem', () => {
    const out = formatProblems([
      { service: 'api', message: 'm1', fix: 'f1' },
      { service: 'web', message: 'm2', fix: 'f2' },
    ]);
    for (const text of ['[api]', 'm1', 'f1', '[web]', 'm2', 'f2']) {
      expect(out).toContain(text);
    }
    expect(out.split('\n').length).toBeGreaterThanOrEqual(4);
  });

  it('returns an empty string for no problems', () => {
    expect(formatProblems([])).toBe('');
  });
});
