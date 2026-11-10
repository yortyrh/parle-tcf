/**
 * Client-side session: the Better Auth session token (bearer), kept in
 * localStorage so it survives reloads and new tabs. Sessions are validated and
 * revoked by the API; the token is only the credential. Every access is guarded
 * because storage can be missing (server render) or blocked (private mode).
 */
export const SESSION_TOKEN_KEY = 'parle-tcf.session_token';

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | null {
  try {
    return storage()?.getItem(SESSION_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveSessionToken(token: string): void {
  if (!token) return;
  try {
    storage()?.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // Storage blocked: the session lasts for this page only.
  }
}

export function clearSessionToken(): void {
  try {
    storage()?.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
