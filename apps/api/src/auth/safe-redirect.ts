/** Default landing page after sign-in (mirrors apps/web/lib/safe-redirect.ts). */
export const DEFAULT_REDIRECT = "/tcf";

/**
 * Accepts only app-relative paths (`/tcf/tache2`), rejecting absolute and
 * protocol-relative URLs so redirects cannot leave the web app.
 */
export function safeRedirectPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\r\n]/.test(value)
  ) {
    return DEFAULT_REDIRECT;
  }
  return value;
}
