import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { resetEnvCache } from '../config/env.js';
import type { Auth } from './better-auth.js';
import type { OAuthHandoffService } from './oauth-handoff.service.js';
import { OAuthController } from './oauth.controller.js';
import { DEFAULT_REDIRECT } from './safe-redirect.js';

const API = 'https://api.parle.test';
const WEB = 'https://app.parle.test';

const SESSION_COOKIES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
  'better-auth.session_data',
  '__Secure-better-auth.session_data',
];

function stubEnv(extra: Record<string, string> = {}) {
  vi.stubEnv('DATABASE_URL', 'postgresql://u:p@127.0.0.1:5432/db');
  vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32));
  vi.stubEnv('ENCRYPTION_KEYS', `v1:${Buffer.alloc(32, 1).toString('base64')}`);
  vi.stubEnv('ENCRYPTION_KEY_CURRENT', 'v1');
  vi.stubEnv('BETTER_AUTH_URL', `${API}/`);
  vi.stubEnv('WEB_URL', `${WEB}/`);
  for (const key of [
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ]) {
    vi.stubEnv(key, '');
  }
  for (const [key, value] of Object.entries(extra)) vi.stubEnv(key, value);
  resetEnvCache();
}

function fakeResponse() {
  const res = {
    clearCookie: vi.fn(),
    redirect: vi.fn(),
    append: vi.fn(),
  };
  return { res, asResponse: res as unknown as Response };
}

describe('OAuthController', () => {
  let getSession: ReturnType<typeof vi.fn>;
  let signInSocial: ReturnType<typeof vi.fn>;
  let handoff: { issue: ReturnType<typeof vi.fn>; redeem: ReturnType<typeof vi.fn> };
  let controller: OAuthController;

  beforeEach(() => {
    stubEnv();
    getSession = vi.fn();
    signInSocial = vi.fn();
    handoff = { issue: vi.fn(async () => 'one-time-code'), redeem: vi.fn() };
    controller = new OAuthController(
      { api: { getSession, signInSocial } } as unknown as Auth,
      handoff as unknown as OAuthHandoffService
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  describe('complete', () => {
    const req = { headers: { cookie: 'better-auth.session_token=abc' } } as unknown as Request;

    it('trades the session for a one-time code and redirects to the web callback', async () => {
      getSession.mockResolvedValue({ session: { token: 'session-token' }, user: { id: 'u' } });
      const { res, asResponse } = fakeResponse();

      await controller.complete(req, '/sujets?task=2', asResponse);

      expect(handoff.issue).toHaveBeenCalledWith('session-token');
      expect(res.redirect).toHaveBeenCalledTimes(1);
      const [status, location] = res.redirect.mock.calls[0] as [number, string];
      expect(status).toBe(302);
      const target = new URL(location);
      expect(target.origin + target.pathname).toBe(`${WEB}/connexion/retour`);
      expect(target.searchParams.get('code')).toBe('one-time-code');
      expect(target.searchParams.get('next')).toBe('/sujets?task=2');
    });

    it('reads the session from the request cookies', async () => {
      getSession.mockResolvedValue(null);
      await controller.complete(req, undefined, fakeResponse().asResponse);
      const headers = (getSession.mock.calls[0]?.[0] as { headers: Headers }).headers;
      expect(headers.get('cookie')).toBe('better-auth.session_token=abc');
    });

    it.each([undefined, 'https://evil.test/', '//evil.test'])(
      'falls back to the default page for an unsafe redirect (%j)',
      async (redirect) => {
        getSession.mockResolvedValue({ session: { token: 'session-token' } });
        const { res, asResponse } = fakeResponse();
        await controller.complete(req, redirect, asResponse);
        const location = new URL(res.redirect.mock.calls[0]?.[1] as string);
        expect(location.searchParams.get('next')).toBe(DEFAULT_REDIRECT);
      }
    );

    it('clears the API session cookies whatever the outcome', async () => {
      getSession.mockResolvedValue({ session: { token: 'session-token' } });
      const ok = fakeResponse();
      await controller.complete(req, undefined, ok.asResponse);
      getSession.mockResolvedValue(null);
      const ko = fakeResponse();
      await controller.complete(req, undefined, ko.asResponse);

      for (const { res } of [ok, ko]) {
        expect(res.clearCookie.mock.calls.map((c) => c[0])).toEqual(SESSION_COOKIES);
        for (const call of res.clearCookie.mock.calls) expect(call[1]).toEqual({ path: '/' });
      }
    });

    it.each([
      ['no session', null],
      ['a session without token', { session: {} }],
      ['an empty token', { session: { token: '' } }],
    ])('redirects to the sign-in error page with %s', async (_label, session) => {
      getSession.mockResolvedValue(session);
      const { res, asResponse } = fakeResponse();
      await controller.complete(req, '/sujets', asResponse);
      expect(res.redirect).toHaveBeenCalledWith(302, `${WEB}/connexion?erreur=oauth`);
      expect(handoff.issue).not.toHaveBeenCalled();
    });

    it('treats a Better Auth failure as no session', async () => {
      getSession.mockRejectedValue(new Error('state mismatch'));
      const { res, asResponse } = fakeResponse();
      await controller.complete(req, undefined, asResponse);
      expect(res.redirect).toHaveBeenCalledWith(302, `${WEB}/connexion?erreur=oauth`);
      expect(handoff.issue).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    beforeEach(() => {
      stubEnv({ GITHUB_CLIENT_ID: 'gh-id', GITHUB_CLIENT_SECRET: 'gh-secret' });
    });

    it('starts the provider flow, forwards its cookies and redirects to the provider', async () => {
      const headers = new Headers();
      headers.append('set-cookie', 'better-auth.state=s1; Path=/; HttpOnly');
      headers.append('set-cookie', 'better-auth.pkce=p1; Path=/; HttpOnly');
      signInSocial.mockResolvedValue({
        headers,
        response: { url: 'https://github.com/login/oauth/authorize?state=s1', redirect: false },
      });
      const { res, asResponse } = fakeResponse();

      await controller.start('github', '/sujets', asResponse);

      expect(signInSocial).toHaveBeenCalledWith({
        body: {
          provider: 'github',
          callbackURL: `${API}/auth/oauth/complete?redirect=${encodeURIComponent('/sujets')}`,
          errorCallbackURL: `${WEB}/connexion?erreur=oauth`,
          disableRedirect: true,
        },
        returnHeaders: true,
      });
      expect(res.append.mock.calls).toEqual([
        ['Set-Cookie', 'better-auth.state=s1; Path=/; HttpOnly'],
        ['Set-Cookie', 'better-auth.pkce=p1; Path=/; HttpOnly'],
      ]);
      expect(res.redirect).toHaveBeenCalledWith(
        302,
        'https://github.com/login/oauth/authorize?state=s1'
      );
    });

    it('sanitizes the redirect carried through the callback', async () => {
      signInSocial.mockResolvedValue({
        headers: new Headers(),
        response: { url: 'https://github.com/login' },
      });
      await controller.start('github', 'https://evil.test', fakeResponse().asResponse);
      const body = (signInSocial.mock.calls[0]?.[0] as { body: { callbackURL: string } }).body;
      expect(new URL(body.callbackURL).searchParams.get('redirect')).toBe(DEFAULT_REDIRECT);
    });

    it('404s for a provider that is not configured', async () => {
      await expect(
        controller.start('google', undefined, fakeResponse().asResponse)
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        controller.start('complete', undefined, fakeResponse().asResponse)
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(signInSocial).not.toHaveBeenCalled();
    });

    it('404s for every provider when none is configured', async () => {
      stubEnv();
      await expect(
        controller.start('github', undefined, fakeResponse().asResponse)
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('fails with 400 when Better Auth returns no provider url', async () => {
      signInSocial.mockResolvedValue({ headers: new Headers(), response: {} });
      const { res, asResponse } = fakeResponse();
      await expect(controller.start('github', undefined, asResponse)).rejects.toBeInstanceOf(
        BadRequestException
      );
      expect(res.redirect).not.toHaveBeenCalled();
    });
  });

  describe('exchange', () => {
    it('returns the session token for a valid code', async () => {
      handoff.redeem.mockResolvedValue('session-token');
      await expect(controller.exchange({ code: 'abc' })).resolves.toEqual({
        token: 'session-token',
      });
      expect(handoff.redeem).toHaveBeenCalledWith('abc');
    });

    it('401s for an unknown, used or expired code', async () => {
      handoff.redeem.mockResolvedValue(null);
      await expect(controller.exchange({ code: 'abc' })).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    it.each([
      ['no body', undefined],
      ['no code', {}],
      ['an empty code', { code: '' }],
      ['a non-string code', { code: 42 }],
      ['a code over 200 characters', { code: 'a'.repeat(201) }],
    ])('400s for %s without redeeming', async (_label, body) => {
      await expect(controller.exchange(body)).rejects.toBeInstanceOf(BadRequestException);
      expect(handoff.redeem).not.toHaveBeenCalled();
    });

    it('accepts a code of exactly 200 characters', async () => {
      handoff.redeem.mockResolvedValue('t');
      await expect(controller.exchange({ code: 'a'.repeat(200) })).resolves.toEqual({ token: 't' });
    });
  });
});
