import { Suspense } from 'react';
import { ConnexionForm } from './connexion-form';

export const metadata = { title: 'Connexion' };

export default function ConnexionPage() {
  return (
    <Suspense>
      <ConnexionForm />
    </Suspense>
  );
}
