import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_CONFIG_DEFAULTS } from '@/app-config';
import { cn, getAppConfig, getSiteUrl } from './utils';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cn', () => {
  it('joins truthy classes and lets the last Tailwind utility win', () => {
    const hidden = false;
    expect(cn('p-2', hidden && 'hidden', undefined, 'text-sm')).toBe('p-2 text-sm');
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('getAppConfig', () => {
  it('returns the default configuration', () => {
    expect(getAppConfig()).toBe(APP_CONFIG_DEFAULTS);
  });
});

describe('getSiteUrl', () => {
  it('uses NEXT_PUBLIC_SITE_URL without a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://parle.example/');
    expect(getSiteUrl()).toBe('https://parle.example');
  });

  it('falls back to the local web app', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });
});
