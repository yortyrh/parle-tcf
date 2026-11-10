import { describe, expect, it } from 'vitest';
import { enabledOAuthProviders, oauthStartUrl } from './oauth';

describe('oauthStartUrl', () => {
  it('replaces an unsafe redirect with /tcf and trims the trailing slash', () => {
    expect(oauthStartUrl('github', 'https://evil.com', 'http://api/')).toBe(
      'http://api/auth/oauth/github?redirect=%2Ftcf'
    );
  });

  it('url-encodes a safe redirect', () => {
    expect(oauthStartUrl('google', '/tcf/tache2?x=1&y=2', 'http://localhost:3001')).toBe(
      'http://localhost:3001/auth/oauth/google?redirect=%2Ftcf%2Ftache2%3Fx%3D1%26y%3D2'
    );
  });

  it('removes every trailing slash of the api base', () => {
    expect(oauthStartUrl('github', '/tcf', 'http://api.test///')).toBe(
      'http://api.test/auth/oauth/github?redirect=%2Ftcf'
    );
  });

  it('keeps a path prefix on the api base', () => {
    expect(oauthStartUrl('google', '/settings', 'https://x.test/api/')).toBe(
      'https://x.test/api/auth/oauth/google?redirect=%2Fsettings'
    );
  });

  it.each(['//evil.com', '/\\evil.com', 'tcf', '/a\nb', ''])(
    'falls back to /tcf for %j',
    (next) => {
      expect(oauthStartUrl('github', next, 'http://api')).toBe(
        'http://api/auth/oauth/github?redirect=%2Ftcf'
      );
    }
  );
});

describe('enabledOAuthProviders', () => {
  it('returns nothing when no flag is set', () => {
    expect(enabledOAuthProviders({})).toEqual([]);
  });

  it('returns github alone', () => {
    expect(enabledOAuthProviders({ NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED: 'true' })).toEqual([
      'github',
    ]);
  });

  it('returns google alone', () => {
    expect(enabledOAuthProviders({ NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED: 'true' })).toEqual([
      'google',
    ]);
  });

  it('returns github before google when both are enabled', () => {
    expect(
      enabledOAuthProviders({
        NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED: 'true',
        NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED: 'true',
      })
    ).toEqual(['github', 'google']);
  });

  it.each(['false', 'TRUE', 'True', '1', 'yes', ' true', ''])('treats %j as disabled', (value) => {
    expect(
      enabledOAuthProviders({
        NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED: value,
        NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED: value,
      })
    ).toEqual([]);
  });

  it('ignores unrelated keys', () => {
    expect(
      enabledOAuthProviders({
        NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED: undefined,
        AUTH_GOOGLE_OAUTH_ENABLED: 'true',
        GITHUB_CLIENT_ID: 'id',
      })
    ).toEqual([]);
  });
});
