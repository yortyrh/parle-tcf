import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { loggerParams, pinoOptions, scrubSecrets } from './logger.config.js';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  return { lines, logger: pino(pinoOptions({ NODE_ENV: 'test' }), stream) };
}

const KEY = 'sk-proj-abcdefghijklmnop1234';

describe('logger redaction', () => {
  it('scrubs keys in free text', () => {
    expect(scrubSecrets(`bad key ${KEY} and Bearer abc.def`)).toBe(
      'bad key sk-[REDACTED] and Bearer [REDACTED]'
    );
  });

  it('redacts sensitive fields and headers', () => {
    const { lines, logger } = capture();
    logger.info({
      req: { headers: { authorization: `Bearer ${KEY}`, cookie: 's=1' } },
      apiKey: KEY,
      user: { apiKey: KEY, password: 'hunter2' },
    });
    expect(lines.join('')).not.toContain(KEY);
    expect(lines.join('')).not.toContain('hunter2');
  });

  it('scrubs keys inside messages and errors', () => {
    const { lines, logger } = capture();
    logger.error(`failed with ${KEY}`);
    logger.error(new Error(`401 for ${KEY}`));
    expect(lines.join('')).not.toContain(KEY);
  });
});

describe('log level', () => {
  it('logs info and above in production, debug elsewhere', () => {
    expect(pinoOptions({ NODE_ENV: 'production' }).level).toBe('info');
    expect(pinoOptions({ NODE_ENV: 'development' }).level).toBe('debug');
    expect(pinoOptions({ NODE_ENV: 'test' }).level).toBe('debug');
  });
});

describe('loggerParams (HTTP logging)', () => {
  type HttpOptions = {
    level: string;
    redact: unknown;
    autoLogging: { ignore: (req: { url: string }) => boolean };
    serializers: { req: (req: Record<string, unknown>) => unknown };
  };
  const http = (NODE_ENV = 'production') =>
    loggerParams({ NODE_ENV }).pinoHttp as unknown as HttpOptions;

  it('reuses the base options (level and redaction)', () => {
    expect(http('production').level).toBe('info');
    expect(http('development').level).toBe('debug');
    expect(http().redact).toEqual(pinoOptions({ NODE_ENV: 'production' }).redact);
  });

  it('skips the health check only', () => {
    const { ignore } = http().autoLogging;
    expect(ignore({ url: '/health' })).toBe(true);
    expect(ignore({ url: '/health?probe=1' })).toBe(false);
    expect(ignore({ url: '/attempts/list' })).toBe(false);
  });

  it('logs the method and url of a request, never its body or headers', () => {
    const serialized = http().serializers.req({
      method: 'POST',
      url: '/settings/upsert',
      headers: { authorization: `Bearer ${KEY}` },
      body: { apiKey: KEY },
    });
    expect(serialized).toEqual({ method: 'POST', url: '/settings/upsert' });
  });
});
