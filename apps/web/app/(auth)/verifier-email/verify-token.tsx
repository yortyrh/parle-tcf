'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell, FormError } from '@/components/app/auth-shell';
import { authClient } from '@/lib/auth-client';
import { DEFAULT_REDIRECT } from '@/lib/safe-redirect';

/** Opens from the confirmation email: verifies the token, which also signs the user in. */
export function VerifyToken({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void authClient.verifyEmail({ query: { token } }).then(({ error: authError }) => {
      if (authError) {
        setError(
          'Ce lien de confirmation est invalide ou a expiré. Connectez-vous pour en recevoir un nouveau.'
        );
        return;
      }
      router.replace(DEFAULT_REDIRECT);
    });
  }, [token, router]);

  return (
    <AuthShell
      title="Confirmation de votre e-mail"
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
          Vérification en cours…
        </p>
      )}
    </AuthShell>
  );
}
