'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell, FieldLabel, FormError } from '@/components/app/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function InscriptionForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    setPending(true);
    setError(null);
    const { data, error: authError } = await authClient.signUp.email({
      name: String(form.get('name')),
      email,
      password: String(form.get('password')),
    });
    setPending(false);
    if (authError) {
      setError(
        authError.status === 422
          ? 'Un compte existe déjà avec cette adresse e-mail.'
          : (authError.message ?? "Impossible de créer le compte pour l'instant.")
      );
      return;
    }
    // With email verification on, no session is created until the link is opened.
    if (data?.token) {
      router.replace('/parametres?bienvenue=1');
      router.refresh();
    } else {
      router.replace(`/verifier-email?email=${encodeURIComponent(email)}`);
    }
  }

  return (
    <AuthShell
      title="Créer un compte"
      description="Gratuit. Vous utilisez votre propre clé API OpenAI."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link href="/connexion" className="text-primary underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
          <FieldLabel htmlFor="name">Prénom</FieldLabel>
          <Input id="name" name="name" autoComplete="given-name" required maxLength={80} />
        </div>
        <div>
          <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <FieldLabel htmlFor="password">Mot de passe (8 caractères minimum)</FieldLabel>
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
          {pending ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
    </AuthShell>
  );
}
