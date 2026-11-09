'use client';

import Link from 'next/link';
import { CRITERIA, CRITERION_LABELS } from '@parle-tcf/shared';
import { LevelBadge } from '@/components/app/level-badge';
import { PageShell } from '@/components/app/page-shell';
import { useAttempt } from '@/hooks/useAttempt';
import { TASK_LABELS } from '@/lib/cefr';

function Column({ id }: { id: string }) {
  const { attempt, error } = useAttempt(id);
  if (error)
    return (
      <p role="alert" className="text-destructive">
        {error}
      </p>
    );
  if (!attempt) return <p role="status">Chargement…</p>;
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
    </section>
  );
}

export function CompareView({ a, b }: { a?: string; b?: string }) {
  return (
    <PageShell title="Comparer deux tentatives">
      {a && b ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Column id={a} />
          <Column id={b} />
        </div>
      ) : (
        <p className="text-muted-foreground">
          Sélectionnez deux tentatives dans l’
          <Link href="/historique" className="underline">
            historique
          </Link>
          .
        </p>
      )}
    </PageShell>
  );
}
