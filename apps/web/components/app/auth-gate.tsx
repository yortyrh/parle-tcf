'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { getSessionToken } from '@/lib/session-token';

/**
 * Client-side session guard for the app area: redirects to the login page
 * when there is no valid session. The session store keeps the last answer, so
 * after a sign-out followed by a sign-in in the same tab it can still hold
 * `null`; with a stored token the session is fetched again once before
 * deciding.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isPending, refetch } = authClient.useSession();
  const refetched = useRef(false);
  const [refetching, setRefetching] = useState(false);

  useEffect(() => {
    if (isPending || data || refetching) return;
    if (!refetched.current && getSessionToken()) {
      refetched.current = true;
      setRefetching(true);
      void refetch().finally(() => setRefetching(false));
      return;
    }
    router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
  }, [isPending, data, refetching, refetch, pathname, router]);

  if (isPending || !data) {
    return (
      <div className="flex min-h-svh items-center justify-center" role="status">
        <span className="text-muted-foreground text-sm">Chargement…</span>
      </div>
    );
  }
  return <>{children}</>;
}
