import { describe, expect, it } from 'vitest';
import { exampleKeys, missingEnvKeys } from './env-example.mjs';

const EXAMPLE = [
  '# API environment. Copy to .env and fill in.',
  '',
  'DATABASE_URL=postgresql://parle:parle@localhost:5432/parle',
  'BETTER_AUTH_SECRET=',
  '',
  '# Optional: S3-compatible storage for recordings.',
  '# S3_BUCKET=',
  '#S3_ENDPOINT=https://example.r2.cloudflarestorage.com',
  '  PORT = 3001',
  '',
  '# NOTE: leave empty to disable OAuth',
  '# GITHUB_CLIENT_ID=',
].join('\n');

describe('exampleKeys', () => {
  it('returns set and commented-out variables in file order', () => {
    expect(exampleKeys(EXAMPLE)).toEqual([
      'DATABASE_URL',
      'BETTER_AUTH_SECRET',
      'S3_BUCKET',
      'S3_ENDPOINT',
      'PORT',
      'GITHUB_CLIENT_ID',
    ]);
  });

  it('returns each variable once, at its first position', () => {
    const text = ['# SMTP_URL=smtp://a', 'MAIL_FROM=x', 'SMTP_URL=smtp://b', 'MAIL_FROM=y'].join(
      '\n'
    );
    expect(exampleKeys(text)).toEqual(['SMTP_URL', 'MAIL_FROM']);
  });

  it('ignores prose comments, even when they contain "=" or upper-case words', () => {
    const text = [
      '# Values: true = on, false = off',
      '# See README for DATABASE_URL',
      '# NOTE: KEY=VALUE pairs only',
      '#',
      '# PORT',
    ].join('\n');
    expect(exampleKeys(text)).toEqual([]);
  });

  it('ignores lower-case and mixed-case names', () => {
    expect(exampleKeys('foo=bar\nMixed_Case=1\n# lower=1')).toEqual([]);
  });

  it('accepts digits and underscores after the first letter, not a leading digit', () => {
    expect(exampleKeys('S3_FORCE_PATH_STYLE=false\n1BAD=x\n_BAD=x')).toEqual([
      'S3_FORCE_PATH_STYLE',
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(exampleKeys('A_KEY=1\r\n# B_KEY=\r\n')).toEqual(['A_KEY', 'B_KEY']);
  });

  it('returns nothing for an empty file', () => {
    expect(exampleKeys('')).toEqual([]);
  });
});

describe('missingEnvKeys', () => {
  it('returns schema keys absent from the example, in schema order', () => {
    const schema = ['WEB_URL', 'DATABASE_URL', 'SMTP_URL', 'PORT', 'RESEND_API_KEY'];
    expect(missingEnvKeys(schema, EXAMPLE)).toEqual(['WEB_URL', 'SMTP_URL', 'RESEND_API_KEY']);
  });

  it('counts commented-out variables as documented', () => {
    expect(missingEnvKeys(['S3_BUCKET', 'GITHUB_CLIENT_ID'], EXAMPLE)).toEqual([]);
  });

  it('does not count a name that only appears in prose', () => {
    expect(missingEnvKeys(['WEB_URL'], '# WEB_URL is the public web origin')).toEqual(['WEB_URL']);
  });

  it('skips ignored keys', () => {
    expect(
      missingEnvKeys(['NODE_ENV', 'WEB_URL', 'PORT'], EXAMPLE, { ignore: ['NODE_ENV'] })
    ).toEqual(['WEB_URL']);
    expect(
      missingEnvKeys(['NODE_ENV', 'WEB_URL'], EXAMPLE, { ignore: ['NODE_ENV', 'WEB_URL'] })
    ).toEqual([]);
  });

  it('ignores nothing by default', () => {
    expect(missingEnvKeys(['NODE_ENV'], EXAMPLE)).toEqual(['NODE_ENV']);
    expect(missingEnvKeys(['NODE_ENV'], EXAMPLE, {})).toEqual(['NODE_ENV']);
  });

  it('returns nothing when the schema is empty or fully documented', () => {
    expect(missingEnvKeys([], EXAMPLE)).toEqual([]);
    expect(missingEnvKeys(['DATABASE_URL', 'BETTER_AUTH_SECRET'], EXAMPLE)).toEqual([]);
  });
});
