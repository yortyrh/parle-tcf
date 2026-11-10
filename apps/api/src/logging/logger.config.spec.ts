import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { pinoOptions, scrubSecrets } from './logger.config.js';

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
