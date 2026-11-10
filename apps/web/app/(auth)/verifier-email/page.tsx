import Link from 'next/link';
import { AuthShell } from '@/components/app/auth-shell';
import { VerifyToken } from './verify-token';

export const metadata = { title: 'Vérifiez votre e-mail · parle-tcf' };

export default async function VerifierEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;
  if (token) return <VerifyToken token={token} />;
  return (
    <AuthShell
      title="Vérifiez votre boîte de réception"
      description={
        email
          ? `Nous avons envoyé un lien de confirmation à ${email}.`
          : 'Nous vous avons envoyé un lien de confirmation.'
      }
      footer={
        <Link href="/connexion" className="text-primary underline">
          Retour à la connexion
        </Link>
      }
    >
      <p className="text-muted-foreground text-center text-sm">
        Cliquez sur le lien pour activer votre compte, puis connectez-vous.
      </p>
    </AuthShell>
  );
}
