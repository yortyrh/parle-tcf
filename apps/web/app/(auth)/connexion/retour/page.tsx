import { OAuthReturn } from './oauth-return';

export const metadata = { title: 'Connexion' };

export default async function OAuthReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>;
}) {
  const { code, next } = await searchParams;
  return <OAuthReturn code={code ?? ''} next={next ?? ''} />;
}
