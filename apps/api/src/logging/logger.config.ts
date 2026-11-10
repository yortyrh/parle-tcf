import type { Params } from 'nestjs-pino';
import type { LoggerOptions } from 'pino';

const SECRET_PATTERN = /\b(sk|ek)-[A-Za-z0-9_-]{8,}/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;

/** Masks API keys and bearer tokens that slipped into a free-form string. */
export function scrubSecrets(text: string): string {
  return text.replace(SECRET_PATTERN, '$1-[REDACTED]').replace(BEARER_PATTERN, 'Bearer [REDACTED]');
}

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'apiKey',
  'api_key',
  '*.apiKey',
  '*.api_key',
  '*.apiKeyCiphertext',
  '*.authTag',
  'clientSecret',
  '*.clientSecret',
  'password',
  '*.password',
];

export function pinoOptions(env: { NODE_ENV: string }): LoggerOptions {
  return {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    hooks: {
      // Last line of defence: scrub keys embedded in messages and error text.
      logMethod(args, method) {
        const scrubbed = args.map((a) =>
          typeof a === 'string'
            ? scrubSecrets(a)
            : a instanceof Error
              ? Object.assign(a, { message: scrubSecrets(a.message) })
              : a
        ) as Parameters<typeof method>;
        method.apply(this, scrubbed);
      },
    },
  };
}

export function loggerParams(env: { NODE_ENV: string }): Params {
  return {
    pinoHttp: {
      ...pinoOptions(env),
      autoLogging: { ignore: (req) => req.url === '/health' },
      // Request bodies are never logged: they carry keys and transcripts.
      serializers: {
        req: (req: { method: string; url: string }) => ({
          method: req.method,
          url: req.url,
        }),
      },
    },
  };
}
