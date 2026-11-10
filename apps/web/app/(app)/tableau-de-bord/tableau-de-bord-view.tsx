'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AttemptSummary, ProviderSettings, Usage } from '@parle-tcf/shared';
import { ArrowRightIcon, KeyIcon } from '@phosphor-icons/react';
import { LevelBadge } from '@/components/app/level-badge';
import { TrendBadge } from '@/components/app/level-trend';
import { PageShell } from '@/components/app/page-shell';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { TASK_LABELS } from '@/lib/cefr';
import { type Recommendation, recommendNextTask } from '@/lib/dashboard';
import { levelSeries, levelTrend } from '@/lib/level-series';

const REASONS: Record<Recommendation['reason'], string> = {
  'never-tried': 'Vous ne l’avez pas encore essayée : commencez par découvrir son déroulement.',
  'lowest-level': 'C’est votre tâche la plus faible pour le moment : un entraînement ciblé paiera.',
  'least-recent': 'C’est celle que vous avez travaillée il y a le plus longtemps.',
};

const TASK_SUMMARY: Record<number, string> = {
  1: 'Entretien dirigé · 2 min',
  2: 'Interaction · 2 min de préparation + 3 min 30',
  3: 'Point de vue · 4 min 30',
};

interface DashboardData {
  attempts: AttemptSummary[];
  usage: Usage | null;
  settings: ProviderSettings | null;
}

export function TableauDeBordView() {
  const { data: session } = authClient.useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [attempts, usage, settings] = await Promise.all([
        api.listAttempts({ limit: 100 }),
        api.getUsage().catch(() => null),
        api.getSettings().catch(() => null),
      ]);
      setData({ attempts: attempts.items, usage, settings });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const firstName = session?.user.name?.split(' ')[0];

  return (
    <PageShell
      title={firstName ? `Bonjour ${firstName}` : 'Tableau de bord'}
      description="Votre prochaine étape, vos derniers passages et l’évolution de votre niveau."
      actions={
        <Button asChild variant="secondary">
          <Link href="/examen">Examen complet</Link>
        </Button>
      }
    >
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {!data && !error && <DashboardSkeleton />}
      {data && <Dashboard data={data} />}
    </PageShell>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3" role="status" aria-label="Chargement">
      <Skeleton className="h-48 rounded-2xl lg:col-span-2" />
      <Skeleton className="h-48 rounded-2xl" />
      <ListSkeleton className="lg:col-span-2" />
    </div>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const { attempts, usage, settings } = data;
  const next = recommendNextTask(attempts);
  const recent = attempts.slice(0, 5);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {settings && !settings.configured && (
        <div className="bg-highlight-soft flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center lg:col-span-3">
          <KeyIcon className="text-highlight size-6 shrink-0" aria-hidden />
          <p className="flex-1 text-sm">
            Ajoutez votre clé API OpenAI ou Gemini pour lancer une session : elle reste chiffrée et
            vous ne payez que ce que vous utilisez.
          </p>
          <Button asChild variant="primary" size="sm">
            <Link href="/parametres">Ajouter ma clé</Link>
          </Button>
        </div>
      )}

      <section
        aria-labelledby="next-task"
        className="bg-primary text-primary-foreground shadow-raised relative overflow-hidden rounded-2xl p-6 sm:p-8 lg:col-span-2"
      >
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
          Prochaine étape conseillée
        </p>
        <h2 id="next-task" className="font-display text-headline mt-2">
          {TASK_LABELS[next.task]}
        </h2>
        <p className="mt-1 text-sm opacity-90">{TASK_SUMMARY[next.task]}</p>
        <p className="mt-4 max-w-lg text-sm opacity-90">{REASONS[next.reason]}</p>
        <Button
          asChild
          size="lg"
          className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 mt-6"
        >
          <Link href={`/tcf/tache${next.task}`}>
            Commencer <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
        <span
          aria-hidden
          className="font-display pointer-events-none absolute -bottom-10 -right-4 select-none text-[10rem] leading-none opacity-10"
        >
          {next.task}
        </span>
      </section>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">Aujourd’hui</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {usage ? (
            <>
              <div>
                <p className="mb-2 flex justify-between">
                  <span>Minutes de session</span>
                  <span className="font-medium tabular-nums">
                    {usage.todayMinutes.toFixed(0)} / {usage.dailyMinutesLimit}
                  </span>
                </p>
                <Progress
                  value={Math.min(100, (usage.todayMinutes / usage.dailyMinutesLimit) * 100)}
                  aria-label="Minutes utilisées aujourd’hui"
                />
              </div>
              <div>
                <p className="mb-2 flex justify-between">
                  <span>Coût estimé ce mois-ci</span>
                  <span className="font-medium tabular-nums">
                    {usage.monthCostUsd.toFixed(2).replace('.', ',')} $ /{' '}
                    {usage.monthlyCostLimitUsd} $
                  </span>
                </p>
                <Progress
                  value={Math.min(100, (usage.monthCostUsd / usage.monthlyCostLimitUsd) * 100)}
                  aria-label="Coût estimé du mois"
                />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Utilisation indisponible.</p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="recent" className="lg:col-span-2">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="recent" className="font-display text-title">
            Derniers passages
          </h2>
          {attempts.length > 0 && (
            <Link
              href="/historique"
              className="text-primary text-sm underline-offset-4 hover:underline"
            >
              Tout l’historique
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title="Aucun passage pour l’instant"
            description="Faites une première tâche : l’examinateur vous guide, puis une évaluation CECRL détaillée arrive en quelques secondes."
            action={
              <Button asChild variant="primary">
                <Link href="/tcf/tache1">Commencer par la tâche 1</Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/resultats/${a.id}`}
                  className="bg-card hover:border-primary/40 flex items-center gap-4 rounded-xl border p-4 transition-colors"
                >
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{TASK_LABELS[a.task]}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(a.startedAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {a.mode === 'full' ? ' · examen complet' : ''}
                    </span>
                  </span>
                  {a.evaluationStatus === 'pending' || a.evaluationStatus === 'running' ? (
                    <span className="text-muted-foreground text-xs">évaluation…</span>
                  ) : (
                    <LevelBadge level={a.globalLevel} />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">Niveau par tâche</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3 text-sm">
            {[1, 2, 3].map((task) => {
              const points = levelSeries(attempts, task);
              const last = points[points.length - 1];
              return (
                <li key={task} className="flex items-center justify-between gap-2">
                  <span>{TASK_LABELS[task]}</span>
                  <span className="flex items-center gap-2">
                    <TrendBadge trend={levelTrend(points)} />
                    <LevelBadge level={last?.level ?? null} />
                  </span>
                </li>
              );
            })}
          </ul>
          <Link
            href="/progression"
            className="text-primary mt-4 inline-block text-sm underline-offset-4 hover:underline"
          >
            Voir la progression
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
