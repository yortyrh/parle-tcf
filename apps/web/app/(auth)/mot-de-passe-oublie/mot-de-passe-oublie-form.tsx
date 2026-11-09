'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthShell, FieldLabel, FormError } from '@/components/app/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function MotDePasseOublieForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: authError } = await authClient.requestPasswordReset({
      email: String(form.get('email')),
      redirectTo: `${window.location.origin}/reinitialiser`,
    });
    setPending(false);
    if (authError) {
      setError("Impossible d'envoyer l'e-mail pour l'instant. Réessayez plus tard.");
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title="Mot de passe oublié"
      description="Indiquez votre adresse e-mail pour recevoir un lien de réinitialisation."
      footer={
        <Link href="/connexion" className="text-primary underline">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="text-center text-sm">
          Si un compte existe avec cette adresse, un e-mail vient d&apos;être envoyé.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div>
            <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <FormError message={error} />
          <Button type="submit" variant="primary" size="lg" disabled={pending}>
            {pending ? 'Envoi…' : 'Envoyer le lien'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
