'use client';

import Link from 'next/link';
import type { AttemptDetail } from '@parle-tcf/shared';
import { CRITERIA, CRITERION_LABELS } from '@parle-tcf/shared';
import { LevelBadge } from '@/components/app/level-badge';
import { PageShell } from '@/components/app/page-shell';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { useAttempt } from '@/hooks/useAttempt';
import { TASK_LABELS } from '@/lib/cefr';
import { canCompare } from '@/lib/exam-flow';

function Column({ attempt }: { attempt: AttemptDetail }) {
  return (
    <section
      className="bg-card rounded-lg border p-4"
      aria-label={`Tentative du ${new Date(attempt.startedAt).toLocaleDateString('fr-FR')}`}
    >
      <h2 className="mb-1 font-semibold">{TASK_LABELS[attempt.task]}</h2>
      <p className="text-muted-foreground mb-3 text-xs">
        <Link href={`/resultats/${attempt.id}`} className="underline">
          {new Date(attempt.startedAt).toLocaleString('fr-FR')}
        </Link>
      </p>
      {attempt.evaluation ? (
        <>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            Niveau global <LevelBadge level={attempt.evaluation.globalLevel} />
          </p>
          <ul className="space-y-1 text-sm">
            {CRITERIA.map((c) => (
              <li key={c} className="flex items-center justify-between">
                {CRITERION_LABELS[c]} <LevelBadge level={attempt.evaluation!.criteria[c].level} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Pas d’évaluation disponible.</p>
      )}
      <h3 className="mt-4 mb-2 text-sm font-semibold">Transcription</h3>
      {attempt.transcript.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune transcription.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {attempt.transcript.map((line) => (
            <li key={line.seq}>
              <span className="text-muted-foreground text-xs font-semibold uppercase">
                {line.speaker === 'candidate' ? 'Vous' : 'Examinateur'}
              </span>
              <p>{line.text}</p>
              {line.correctedText && line.correctedText !== line.text && (
                <p className="text-success text-xs">→ {line.correctedText}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Comparison({ a, b }: { a: string; b: string }) {
  const left = useAttempt(a);
  const right = useAttempt(b);
  const error = left.error ?? right.error;
  if (error) return <ErrorState message={error} />;
  if (!left.attempt || !right.attempt) return <ListSkeleton rows={6} />;
  if (!canCompare(left.attempt, right.attempt)) {
    return (
      <EmptyState
        title="Sujets différents"
        description="Seules deux tentatives du même sujet peuvent être comparées."
        action={
          <Button asChild variant="secondary">
            <Link href="/historique">Retour à l’historique</Link>
          </Button>
        }
      />
    );
  }
  return (
    <>
      {left.attempt.exercisePrompt && (
        <p className="text-muted-foreground mb-4 text-sm whitespace-pre-line">
          {left.attempt.exercisePrompt}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Column attempt={left.attempt} />
        <Column attempt={right.attempt} />
      </div>
    </>
  );
}

export function CompareView({ a, b }: { a?: string; b?: string }) {
  return (
    <PageShell title="Comparer deux tentatives">
      {a && b ? (
        <Comparison a={a} b={b} />
      ) : (
        <p className="text-muted-foreground">
          Sélectionnez deux tentatives du même sujet dans l’
          <Link href="/historique" className="underline">
            historique
          </Link>
          .
        </p>
      )}
    </PageShell>
  );
}
