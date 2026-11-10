import { ConfirmDeletion } from './confirm-deletion';

export const metadata = { title: 'Suppression du compte' };

export default async function AccountDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ConfirmDeletion token={token ?? ''} />;
}
