import { safeRedirectPath } from '@/lib/safe-redirect';

/**
 * Social sign-in. The flow runs on the API origin (see apps/api/src/auth/oauth.controller.ts):
 * the browser navigates to `${API}/auth/oauth/:provider?redirect=…`, the provider calls back
 * to the API, which redirects to `/connexion/retour?code=…&next=…` where the code is
 * exchanged for the bearer token.
 */
export type OAuthProvider = 'github' | 'google';

export function oauthStartUrl(provider: OAuthProvider, next: string, apiBase: string): string {
  const base = apiBase.replace(/\/+$/, '');
  return `${base}/auth/oauth/${provider}?redirect=${encodeURIComponent(safeRedirectPath(next))}`;
}

export function enabledOAuthProviders(env: Record<string, string | undefined>): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (env.NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED === 'true') providers.push('github');
  if (env.NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED === 'true') providers.push('google');
  return providers;
}
