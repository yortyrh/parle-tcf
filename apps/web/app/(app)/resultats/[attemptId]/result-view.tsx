'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CRITERIA, CRITERION_LABELS, EVALUATION_DISCLAIMER } from '@parle-tcf/shared';
import { LevelBadge } from '@/components/app/level-badge';
import { PageShell } from '@/components/app/page-shell';
import { ErrorLegend, TranscriptView } from '@/components/app/transcript-view';
import { Button } from '@/components/ui/button';
import { useAttempt } from '@/hooks/useAttempt';
import { api } from '@/lib/api';
import { TASK_LABELS, formatCost, formatDuration } from '@/lib/cefr';

export function ResultView({ attemptId }: { attemptId: string }) {
  const { attempt, error, refresh } = useAttempt(attemptId);
  const [retrying, setRetrying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    api.getAudioDownloadUrl(attemptId).then(
      (r) => setAudioUrl(r.url),
      () => undefined
    );
  }, [attemptId]);

  async function retry() {
    setRetrying(true);
    try {
      await api.reevaluateAttempt(attemptId);
      await refresh();
    } finally {
      setRetrying(false);
    }
  }

  if (error) {
    return (
      <PageShell title="Résultat">
        <p role="alert" className="text-destructive">
          {error}
        </p>
      </PageShell>
    );
  }
  if (!attempt) {
    return (
      <PageShell title="Résultat">
        <p role="status">Chargement…</p>
      </PageShell>
    );
  }

  const pending = attempt.evaluationStatus === 'pending' || attempt.evaluationStatus === 'running';
  const evaluation = attempt.evaluation;

  return (
    <PageShell title={TASK_LABELS[attempt.task] ?? 'Résultat'}>
      <p className="text-muted-foreground mb-6 text-sm">
        Durée {formatDuration(attempt.durationS)} · coût estimé{' '}
        {formatCost(attempt.estimatedCostUsd)}
      </p>

      {pending && (
        <p role="status" className="bg-muted mb-6 rounded-lg p-4 text-sm">
          Évaluation en cours… cette page se met à jour automatiquement.
        </p>
      )}

      {attempt.evaluationStatus === 'failed' && (
        <div role="alert" className="border-destructive/50 mb-6 rounded-lg border p-4 text-sm">
          <p className="mb-3">L’évaluation a échoué. Votre transcription est conservée.</p>
          <Button size="sm" onClick={() => void retry()} disabled={retrying}>
            Relancer l’évaluation
          </Button>
        </div>
      )}

      {audioUrl && (
        <section aria-label="Réécouter l'enregistrement" className="mb-6">
          <audio controls src={audioUrl} className="w-full">
            Votre navigateur ne peut pas lire cet enregistrement.
          </audio>
        </section>
      )}

      {evaluation && (
        <section aria-labelledby="eval-title" className="mb-8">
          <h2 id="eval-title" className="mb-3 flex items-center gap-3 text-lg font-semibold">
            Niveau global <LevelBadge level={evaluation.globalLevel} />
          </h2>
          <p className="mb-4 text-sm">{evaluation.summary}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {CRITERIA.map((c) => (
              <li key={c} className="bg-card rounded-lg border p-3">
                <p className="mb-1 flex items-center justify-between text-sm font-semibold">
                  {CRITERION_LABELS[c]} <LevelBadge level={evaluation.criteria[c].level} />
                </p>
                <p className="text-muted-foreground text-sm">{evaluation.criteria[c].comment}</p>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-4 text-xs">{EVALUATION_DISCLAIMER}</p>
        </section>
      )}

      <section aria-labelledby="transcript-title" className="mb-8">
        <h2 id="transcript-title" className="mb-3 text-lg font-semibold">
          Transcription {evaluation ? 'corrigée' : ''}
        </h2>
        {evaluation && <ErrorLegend />}
        <TranscriptView lines={attempt.transcript} corrected={Boolean(evaluation)} />
      </section>

      <div className="flex flex-wrap gap-3">
        {attempt.exerciseId && attempt.task !== 1 && (
          <Button asChild variant="primary">
            <Link href={`/tcf/tache${attempt.task}/${attempt.exerciseId}`}>Refaire ce sujet</Link>
          </Button>
        )}
        <Button asChild variant="secondary">
          <Link href="/historique">Voir l’historique</Link>
        </Button>
      </div>
    </PageShell>
  );
}
