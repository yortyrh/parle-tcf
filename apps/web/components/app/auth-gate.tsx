'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

/**
 * Client-side session guard for the app area. Redirects to the login page
 * when the cookie is stale (the middleware only checks it exists).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !data) {
      router.replace(`/connexion?next=${encodeURIComponent(pathname)}`);
    }
  }, [isPending, data, pathname, router]);

  if (isPending || !data) {
    return (
      <div className="flex min-h-svh items-center justify-center" role="status">
        <span className="text-muted-foreground text-sm">Chargement…</span>
      </div>
    );
  }
  return <>{children}</>;
}
