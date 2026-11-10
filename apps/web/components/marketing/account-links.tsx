'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getSessionToken } from '@/lib/session-token';

/** Header actions: sign in / sign up, or straight to the app when a session exists. */
export function AccountLinks() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(getSessionToken()));
  }, []);

  if (signedIn) {
    return (
      <Button asChild variant="primary" size="sm">
        <Link href="/tableau-de-bord">Ouvrir l’application</Link>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/connexion">Se connecter</Link>
      </Button>
      <Button asChild variant="primary" size="sm" className="hidden sm:inline-flex">
        <Link href="/inscription">Créer un compte</Link>
      </Button>
    </div>
  );
}
