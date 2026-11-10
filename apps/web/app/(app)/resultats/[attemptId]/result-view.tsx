'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CRITERIA, CRITERION_LABELS, EVALUATION_DISCLAIMER } from '@parle-tcf/shared';
import { LevelBadge } from '@/components/app/level-badge';
import { PageShell } from '@/components/app/page-shell';
import { ErrorState, ListSkeleton } from '@/components/app/states';
import { ErrorLegend, TranscriptView } from '@/components/app/transcript-view';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAttempt } from '@/hooks/useAttempt';
import { api } from '@/lib/api';
import { TASK_LABELS, formatCost, formatDuration } from '@/lib/cefr';
import { levelPercent } from '@/lib/level-series';

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
        <ErrorState message={error} onRetry={() => void refresh()} />
      </PageShell>
    );
  }
  if (!attempt) {
    return (
      <PageShell title="Résultat">
        <div className="grid gap-6 lg:grid-cols-3" role="status" aria-label="Chargement">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl lg:col-span-2" />
          <ListSkeleton className="lg:col-span-3" />
        </div>
      </PageShell>
    );
  }

  const pending = attempt.evaluationStatus === 'pending' || attempt.evaluationStatus === 'running';
  const evaluation = attempt.evaluation;

  return (
    <PageShell
      title={TASK_LABELS[attempt.task] ?? 'Résultat'}
      description={
        <>
          {new Date(attempt.startedAt).toLocaleString('fr-FR', {
            dateStyle: 'long',
            timeStyle: 'short',
          })}{' '}
          · durée {formatDuration(attempt.durationS)} · coût estimé{' '}
          {formatCost(attempt.estimatedCostUsd)}
        </>
      }
      actions={
        <>
          {attempt.exerciseId && attempt.task !== 1 && (
            <Button asChild variant="primary">
              <Link href={`/tcf/tache${attempt.task}/${attempt.exerciseId}`}>Refaire ce sujet</Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link href="/historique">Historique</Link>
          </Button>
        </>
      }
    >
      {pending && (
        <p
          role="status"
          className="bg-primary/5 border-primary/20 mb-6 flex items-center gap-3 rounded-xl border p-4 text-sm"
        >
          <span aria-hidden className="bg-primary size-2 animate-pulse rounded-full" />
          Évaluation en cours… cette page se met à jour automatiquement.
        </p>
      )}

      {attempt.evaluationStatus === 'failed' && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 mb-6 flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p>L’évaluation a échoué. Votre transcription est conservée.</p>
          <Button size="sm" variant="secondary" onClick={() => void retry()} disabled={retrying}>
            {retrying ? 'Relance…' : 'Relancer l’évaluation'}
          </Button>
        </div>
      )}

      {evaluation && (
        <section aria-labelledby="eval-title" className="mb-10 grid gap-6 lg:grid-cols-3">
          <div className="bg-primary text-primary-foreground shadow-raised flex flex-col justify-between gap-4 rounded-2xl p-6">
            <h2
              id="eval-title"
              className="text-sm font-semibold tracking-widest uppercase opacity-80"
            >
              Niveau global
            </h2>
            <p
              className="font-display text-[5rem] leading-none"
              aria-label={`Niveau ${evaluation.globalLevel}`}
            >
              {evaluation.globalLevel}
            </p>
            <p className="text-sm opacity-90">{evaluation.summary}</p>
          </div>
          <div className="bg-card shadow-card rounded-2xl border p-6 lg:col-span-2">
            <h3 className="font-display text-title mb-4">Par critère</h3>
            <ul className="flex flex-col gap-4">
              {CRITERIA.map((c) => {
                const { level, comment } = evaluation.criteria[c];
                return (
                  <li key={c}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium">
                      <span>{CRITERION_LABELS[c]}</span>
                      <LevelBadge level={level} />
                    </div>
                    <div
                      className="bg-muted h-2 overflow-hidden rounded-full"
                      role="meter"
                      aria-label={`${CRITERION_LABELS[c]} : ${level}`}
                      aria-valuemin={1}
                      aria-valuemax={6}
                      aria-valuenow={Math.round((levelPercent(level) * 6) / 100)}
                      aria-valuetext={level}
                    >
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${levelPercent(level)}%` }}
                      />
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-sm">{comment}</p>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground mt-6 text-xs">{EVALUATION_DISCLAIMER}</p>
          </div>
        </section>
      )}

      {audioUrl && (
        <section aria-label="Réécouter l'enregistrement" className="mb-8">
          <audio controls src={audioUrl} className="w-full">
            Votre navigateur ne peut pas lire cet enregistrement.
          </audio>
        </section>
      )}

      <section aria-labelledby="transcript-title">
        <h2 id="transcript-title" className="font-display text-title mb-3">
          {evaluation ? 'Vos phrases corrigées' : 'Transcription'}
        </h2>
        {evaluation && <ErrorLegend />}
        <TranscriptView lines={attempt.transcript} corrected={Boolean(evaluation)} />
      </section>
    </PageShell>
  );
}
