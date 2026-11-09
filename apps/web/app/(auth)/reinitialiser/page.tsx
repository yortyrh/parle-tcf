import { Suspense } from 'react';
import { ReinitialiserForm } from './reinitialiser-form';

export const metadata = { title: 'Nouveau mot de passe · parle-tcf' };

export default function ReinitialiserPage() {
  return (
    <Suspense>
      <ReinitialiserForm />
    </Suspense>
  );
}
