import { createAuthClient } from 'better-auth/react';
import { getApiBase } from '@/lib/api';
import { getSessionToken, saveSessionToken } from '@/lib/session-token';

/**
 * Better Auth client in bearer mode: the API lives on another site, so no cookies.
 * Every request sends the stored token; any response that opens a session
 * (sign-in, email verification, OAuth exchange) returns it in `set-auth-token`.
 */
export const authClient = createAuthClient({
  baseURL: getApiBase(),
  fetchOptions: {
    credentials: 'omit',
    auth: { type: 'Bearer', token: () => getSessionToken() ?? '' },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get('set-auth-token');
      if (token) saveSessionToken(token);
    },
  },
});
