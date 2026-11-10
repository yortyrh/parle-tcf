'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthShell, FieldLabel, FormError } from '@/components/app/auth-shell';
import { OAuthButtons } from '@/components/app/oauth-buttons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { formText } from '@/lib/form';
import { safeRedirectPath } from '@/lib/safe-redirect';

export function ConnexionForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectPath(params.get('next'));
  const [error, setError] = useState<string | null>(
    params.get('erreur') === 'oauth'
      ? 'La connexion avec ce fournisseur a échoué. Réessayez.'
      : null
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: authError } = await authClient.signIn.email({
      email: formText(form, 'email'),
      password: formText(form, 'password'),
    });
    setPending(false);
    if (authError) {
      setError(
        authError.status === 403
          ? 'Confirmez votre adresse e-mail avant de vous connecter (vérifiez votre boîte de réception).'
          : 'E-mail ou mot de passe incorrect.'
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthShell
      title="Connexion"
      description="Retrouvez vos entraînements à l'expression orale du TCF."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link href="/inscription" className="text-primary underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <OAuthButtons next={next} />
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
          <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <FormError message={error} />
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? 'Connexion…' : 'Se connecter'}
        </Button>
        <Link
          href="/mot-de-passe-oublie"
          className="text-muted-foreground text-center text-sm underline"
        >
          Mot de passe oublié ?
        </Link>
      </form>
    </AuthShell>
  );
}
