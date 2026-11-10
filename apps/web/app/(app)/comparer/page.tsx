import { CompareView } from './compare-view';

export const metadata = { title: 'Comparer' };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  return <CompareView a={a} b={b} />;
}
