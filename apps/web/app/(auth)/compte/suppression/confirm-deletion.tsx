'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthShell, FormError } from '@/components/app/auth-shell';
import { Button } from '@/components/ui/button';
import { getApiBase } from '@/lib/api';
import { authHeaders, clearSessionToken } from '@/lib/session-token';

/** Opens from the deletion email. The account is only erased after an explicit click. */
export function ConfirmDeletion({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setState('pending');
    setError(null);
    const url = new URL(`${getApiBase()}/api/auth/delete-user/callback`);
    url.searchParams.set('token', token);
    const res = await fetch(url, { credentials: 'omit', headers: authHeaders() }).catch(() => null);
    if (!res?.ok) {
      setState('idle');
      setError(
        res?.status === 404 || res?.status === 401
          ? 'Connectez-vous sur cet appareil avec le compte à supprimer, puis rouvrez le lien.'
          : 'Ce lien est invalide ou a expiré. Recommencez depuis les paramètres.'
      );
      return;
    }
    clearSessionToken();
    setState('done');
  }

  if (state === 'done') {
    return (
      <AuthShell
        title="Compte supprimé"
        description="Votre compte et toutes vos données ont été effacés."
        footer={
          <Link href="/" className="text-primary underline">
            Retour à l’accueil
          </Link>
        }
      >
        <p className="text-muted-foreground text-center text-sm">
          Merci d’avoir utilisé parle-tcf.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Supprimer votre compte"
      description="Vos tentatives, évaluations, enregistrements et clés d’API seront effacés définitivement."
      footer={
        <Link href="/parametres" className="text-primary underline">
          Annuler
        </Link>
      }
    >
      <FormError message={token ? error : 'Lien incomplet : rouvrez le lien reçu par e-mail.'} />
      <Button
        type="button"
        variant="destructive"
        size="lg"
        className="w-full"
        disabled={!token || state === 'pending'}
        onClick={onConfirm}
      >
        {state === 'pending' ? 'Suppression…' : 'Supprimer définitivement'}
      </Button>
    </AuthShell>
  );
}
