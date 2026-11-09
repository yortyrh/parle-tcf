/** Default landing page after sign-in. */
export const DEFAULT_REDIRECT = '/tcf';

/**
 * Accepts only app-relative paths (`/tcf/tache2`), rejecting absolute and
 * protocol-relative URLs to prevent open redirects.
 */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_REDIRECT;
  }
  if (value.includes('\\') || /[\r\n]/.test(value)) {
    return DEFAULT_REDIRECT;
  }
  return value;
}
