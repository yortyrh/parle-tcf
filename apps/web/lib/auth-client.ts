import { createAuthClient } from 'better-auth/react';
import { getApiBase } from '@/lib/api';

/** Better Auth client; the session lives in an httpOnly cookie set by the API. */
export const authClient = createAuthClient({
  baseURL: getApiBase(),
  fetchOptions: { credentials: 'include' },
});
