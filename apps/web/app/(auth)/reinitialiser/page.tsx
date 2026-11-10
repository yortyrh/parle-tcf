import { Suspense } from 'react';
import { ReinitialiserForm } from './reinitialiser-form';

export const metadata = { title: 'Nouveau mot de passe' };

export default function ReinitialiserPage() {
  return (
    <Suspense>
      <ReinitialiserForm />
    </Suspense>
  );
}
