'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell, FormError } from '@/components/app/auth-shell';
import { getApiBase } from '@/lib/api';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { saveSessionToken } from '@/lib/session-token';

/** Last step of GitHub/Google sign-in: trades the one-time code for the session token. */
export function OAuthReturn({ code, next }: { code: string; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fail = () => setError('La connexion a échoué ou le lien a expiré. Réessayez.');
    if (!code) return fail();
    fetch(`${getApiBase()}/auth/oauth/exchange`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { token?: string } | null;
        if (!res.ok || !body?.token) return fail();
        saveSessionToken(body.token);
        router.replace(safeRedirectPath(next));
      })
      .catch(fail);
  }, [code, next, router]);

  return (
    <AuthShell
      title="Connexion"
      footer={
        <Link href="/connexion" className="text-primary underline">
          Retour à la connexion
        </Link>
      }
    >
      {error ? (
        <FormError message={error} />
      ) : (
        <p role="status" className="text-muted-foreground text-center text-sm">
          Connexion en cours…
        </p>
      )}
    </AuthShell>
  );
}
