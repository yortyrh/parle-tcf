import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Cheap first gate: bounce visitors without a Better Auth session cookie to
 * the login page. The cookie is only checked for presence here; the API
 * validates it on every call, which is the real access control.
 */
const SESSION_COOKIES = ['better-auth.session_token', '__Secure-better-auth.session_token'];

export function middleware(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  const next = `${url.pathname}${url.search}`;
  url.pathname = '/connexion';
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/tcf/:path*', '/parametres/:path*', '/examen/:path*'],
};
