import { ResultView } from './result-view';

export const metadata = { title: 'Résultat · parle-tcf' };

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ResultView attemptId={attemptId} />;
}
