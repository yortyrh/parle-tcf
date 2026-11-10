'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell, FieldLabel, FormError } from '@/components/app/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { formText } from '@/lib/form';

export function ReinitialiserForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: authError } = await authClient.resetPassword({
      newPassword: formText(form, 'password'),
      token,
    });
    setPending(false);
    if (authError) {
      setError('Ce lien est invalide ou a expiré. Demandez-en un nouveau.');
      return;
    }
    router.replace('/connexion');
  }

  if (!token) {
    return (
      <AuthShell
        title="Lien invalide"
        footer={
          <Link href="/mot-de-passe-oublie" className="text-primary underline">
            Demander un nouveau lien
          </Link>
        }
      >
        <p className="text-muted-foreground text-center text-sm">
          Ce lien de réinitialisation est incomplet.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nouveau mot de passe">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
          <FieldLabel htmlFor="password">Nouveau mot de passe (8 caractères minimum)</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
    </AuthShell>
  );
}
