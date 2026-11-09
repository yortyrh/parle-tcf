'use client';

import { useEffect, useState } from 'react';
import { type AttemptSummary, CEFR_LEVELS, levelScore } from '@parle-tcf/shared';
import { PageShell } from '@/components/app/page-shell';
import { api } from '@/lib/api';
import { TASK_LABELS } from '@/lib/cefr';

const W = 600;
const H = 180;
const PAD = 28;

function Chart({ points }: { points: AttemptSummary[] }) {
  const x = (i: number) =>
    PAD + (points.length === 1 ? (W - 2 * PAD) / 2 : (i * (W - 2 * PAD)) / (points.length - 1));
  const y = (score: number) => H - PAD - ((score - 1) * (H - 2 * PAD)) / 5;
  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(levelScore(p.globalLevel!))}`)
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Niveau par tentative dans le temps"
    >
      {CEFR_LEVELS.map((l, i) => (
        <g key={l}>
          <line
            x1={PAD}
            x2={W - PAD}
            y1={y(i + 1)}
            y2={y(i + 1)}
            stroke="currentColor"
            opacity={0.12}
          />
          <text x={4} y={y(i + 1) + 4} fontSize={11} fill="currentColor">
            {l}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={p.id} cx={x(i)} cy={y(levelScore(p.globalLevel!))} r={4} fill="currentColor">
          <title>
            {new Date(p.startedAt).toLocaleDateString('fr-FR')} : {p.globalLevel}
          </title>
        </circle>
      ))}
    </svg>
  );
}

export function ProgressView() {
  const [items, setItems] = useState<AttemptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listAttempts({ limit: 100 }).then(
      (r) => setItems(r.items),
      (e: unknown) => setError(e instanceof Error ? e.message : 'Erreur de chargement.')
    );
  }, []);

  const graded = (items ?? [])
    .filter((a) => a.globalLevel)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  return (
    <PageShell title="Progression">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {items && graded.length === 0 && (
        <p className="text-muted-foreground">
          Aucune évaluation pour le moment. Faites une tâche pour voir votre progression.
        </p>
      )}
      {[1, 2, 3].map((task) => {
        const points = graded.filter((a) => a.task === task);
        if (points.length === 0) return null;
        const last = points[points.length - 1]!;
        return (
          <section key={task} className="mb-8" aria-labelledby={`t${task}`}>
            <h2 id={`t${task}`} className="mb-2 font-semibold">
              {TASK_LABELS[task]} — dernier niveau : {last.globalLevel}
            </h2>
            <Chart points={points} />
          </section>
        );
      })}
    </PageShell>
  );
}
