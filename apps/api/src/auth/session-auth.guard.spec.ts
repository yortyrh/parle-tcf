import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { Auth } from './better-auth.js';
import { type AuthenticatedRequest, SessionAuthGuard } from './session-auth.guard.js';

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alice@test.local',
  name: 'Alice',
  emailVerified: true,
  image: 'https://img.test/a.png',
};

function contextFor(headers: Record<string, string | undefined>) {
  const request = { headers } as unknown as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
}

describe('SessionAuthGuard', () => {
  let getSession: ReturnType<typeof vi.fn>;
  let guard: SessionAuthGuard;

  beforeEach(() => {
    getSession = vi.fn(async () => ({ user: USER, session: { token: 't' } }));
    guard = new SessionAuthGuard({ api: { getSession } } as unknown as Auth);
  });

  it('accepts a valid bearer token and exposes only id, email and name', async () => {
    const { request, context } = contextFor({ authorization: 'Bearer abc.def' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: USER.id, email: USER.email, name: USER.name });
  });

  it('forwards only the authorization header to Better Auth', async () => {
    const { context } = contextFor({
      authorization: 'Bearer abc.def',
      cookie: 'better-auth.session_token=cookie-token',
    });
    await guard.canActivate(context);
    expect(getSession).toHaveBeenCalledTimes(1);
    const headers = (getSession.mock.calls[0]?.[0] as { headers: Headers }).headers;
    expect(headers.get('authorization')).toBe('Bearer abc.def');
    expect(headers.get('cookie')).toBeNull();
  });

  it.each(['bearer abc', 'BEARER abc', 'Bearer   abc'])(
    'accepts the scheme in any case (%j)',
    async (authorization) => {
      const { context } = contextFor({ authorization });
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }
  );

  it.each([
    ['no header', undefined],
    ['an empty header', ''],
    ['a scheme without token', 'Bearer '],
    ['the scheme only', 'Bearer'],
    ['basic auth', 'Basic dXNlcjpwYXNz'],
    ['a bare token', 'abc.def'],
    ['a scheme glued to the token', 'Bearerabc'],
  ])('rejects %s without asking Better Auth', async (_label, authorization) => {
    const { request, context } = contextFor({ authorization });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getSession).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('ignores a session cookie when there is no bearer token', async () => {
    const { context } = contextFor({ cookie: 'better-auth.session_token=cookie-token' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('rejects an unknown or expired token', async () => {
    getSession.mockResolvedValue(null);
    const { request, context } = contextFor({ authorization: 'Bearer expired' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });

  it('rejects a session without a user', async () => {
    getSession.mockResolvedValue({ session: { token: 't' } });
    const { context } = contextFor({ authorization: 'Bearer abc' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('turns a Better Auth failure into a 401, not a 500', async () => {
    getSession.mockRejectedValue(new Error('db down'));
    const { request, context } = contextFor({ authorization: 'Bearer abc' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.user).toBeUndefined();
  });
});
