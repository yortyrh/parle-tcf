'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type AttemptSummary, CEFR_LEVELS } from '@parle-tcf/shared';
import { LevelBadge } from '@/components/app/level-badge';
import { TrendBadge } from '@/components/app/level-trend';
import { PageShell } from '@/components/app/page-shell';
import { EmptyState, ErrorState } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { TASK_LABELS } from '@/lib/cefr';
import { type LevelPoint, levelSeries, levelTrend } from '@/lib/level-series';

const W = 640;
const H = 240;
const M = { top: 16, right: 16, bottom: 36, left: 40 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Level over time: CEFR y axis, attempt dates on the x axis, focusable points with tooltips. */
function LevelChart({ points, task }: { points: LevelPoint[]; task: number }) {
  const router = useRouter();
  const [active, setActive] = useState<number | null>(null);
  const x = (i: number) =>
    M.left + (points.length === 1 ? PLOT_W / 2 : (i * PLOT_W) / (points.length - 1));
  const y = (score: number) => M.top + PLOT_H - ((score - 1) * PLOT_H) / 5;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.score)}`).join(' ');
  const ticks = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const current = active === null ? null : points[active];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="text-foreground w-full overflow-visible"
        role="img"
        aria-label={`${TASK_LABELS[task]} : ${points.length} évaluation(s), dernier niveau ${points[points.length - 1]!.level}`}
      >
        {CEFR_LEVELS.map((level, i) => (
          <g key={level}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(i + 1)}
              y2={y(i + 1)}
              stroke="currentColor"
              strokeOpacity={0.1}
            />
            <text
              x={M.left - 10}
              y={y(i + 1) + 4}
              fontSize={12}
              textAnchor="end"
              fill="currentColor"
              opacity={0.6}
            >
              {level}
            </text>
          </g>
        ))}
        <line
          x1={M.left}
          x2={W - M.right}
          y1={M.top + PLOT_H}
          y2={M.top + PLOT_H}
          stroke="currentColor"
          strokeOpacity={0.3}
        />
        {ticks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 10}
            fontSize={12}
            textAnchor="middle"
            fill="currentColor"
            opacity={0.6}
          >
            {shortDate(points[i]!.date)}
          </text>
        ))}
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.score)}
            r={active === i ? 7 : 5}
            fill="var(--card)"
            stroke="var(--primary)"
            strokeWidth={2.5}
            tabIndex={0}
            role="button"
            aria-label={`${shortDate(p.date)} : niveau ${p.level}`}
            className="cursor-pointer outline-none focus-visible:stroke-[4]"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onClick={() => router.push(`/resultats/${p.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') router.push(`/resultats/${p.id}`);
            }}
          />
        ))}
      </svg>
      {current && active !== null && (
        <div
          role="tooltip"
          className="bg-popover text-popover-foreground shadow-raised pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border px-3 py-2 text-xs"
          style={{
            left: `${(x(active) / W) * 100}%`,
            top: `${((y(current.score) - 12) / H) * 100}%`,
          }}
        >
          <p className="font-semibold">Niveau {current.level}</p>
          <p className="text-muted-foreground">
            {new Date(current.date).toLocaleString('fr-FR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
      )}
    </div>
  );
}

export function ProgressView() {
  const [items, setItems] = useState<AttemptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.listAttempts({ limit: 100 }).then(
      (r) => setItems(r.items),
      (e: unknown) => setError(e instanceof Error ? e.message : 'Erreur de chargement.')
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const series = [1, 2, 3].map((task) => ({ task, points: levelSeries(items ?? [], task) }));
  const hasAny = series.some((s) => s.points.length > 0);

  return (
    <PageShell
      title="Progression"
      description="Votre niveau évalué à chaque passage, tâche par tâche. Survolez ou parcourez les points au clavier."
    >
      {error && <ErrorState message={error} onRetry={load} />}
      {!items && !error && (
        <div className="flex flex-col gap-6" role="status" aria-label="Chargement">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      )}
      {items && !hasAny && (
        <EmptyState
          title="Pas encore d’évaluation"
          description="Votre courbe apparaîtra après votre première tâche évaluée."
          action={
            <Button asChild variant="primary">
              <Link href="/tcf">S’entraîner</Link>
            </Button>
          }
        />
      )}
      <div className="flex flex-col gap-6">
        {series.map(({ task, points }) => {
          if (points.length === 0) return null;
          const last = points[points.length - 1]!;
          return (
            <section
              key={task}
              aria-labelledby={`t${task}`}
              className="bg-card shadow-card rounded-2xl border p-5 sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 id={`t${task}`} className="font-display text-title">
                  {TASK_LABELS[task]}
                </h2>
                <span className="flex items-center gap-3 text-sm">
                  <TrendBadge trend={levelTrend(points)} />
                  <span className="text-muted-foreground">Dernier niveau</span>
                  <LevelBadge level={last.level} />
                </span>
              </div>
              <LevelChart points={points} task={task} />
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
