'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { AttemptSummary, Usage } from '@parle-tcf/shared';
import { LevelBadge } from '@/components/app/level-badge';
import { PageShell } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { TASK_LABELS, formatCost, formatDuration } from '@/lib/cefr';
import { canCompare } from '@/lib/exam-flow';

const PAGE_SIZE = 20;

export function HistoryView() {
  const [items, setItems] = useState<AttemptSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [task, setTask] = useState<number | undefined>();
  const [mode, setMode] = useState<'full' | 'practice' | undefined>();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Up to two attempts picked for comparison (kept across pages). */
  const [selected, setSelected] = useState<AttemptSummary[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.listAttempts({ task, mode, limit: PAGE_SIZE, offset });
      setItems(res.items);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    }
  }, [task, mode, offset]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    api.getUsage().then(setUsage, () => undefined);
  }, []);

  async function remove(id: string) {
    if (!window.confirm('Supprimer définitivement cette tentative ?')) return;
    await api.deleteAttempt(id);
    setSelected((s) => s.filter((x) => x.id !== id));
    await load();
  }

  function toggle(attempt: AttemptSummary) {
    setSelected((s) =>
      s.some((x) => x.id === attempt.id)
        ? s.filter((x) => x.id !== attempt.id)
        : [...s, attempt].slice(-2)
    );
  }

  const [first, second] = selected;
  const comparable = first && second ? canCompare(first, second) : false;

  return (
    <PageShell title="Historique">
      {usage && (
        <p className="text-muted-foreground mb-4 text-sm">
          Aujourd’hui : {usage.todayMinutes.toFixed(1)} / {usage.dailyMinutesLimit} min · ce mois :{' '}
          {formatCost(usage.monthCostUsd)} / {formatCost(usage.monthlyCostLimitUsd)}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label>
          Tâche{' '}
          <select
            className="bg-background rounded border p-1"
            value={task ?? ''}
            onChange={(e) => {
              setOffset(0);
              setTask(e.target.value ? Number(e.target.value) : undefined);
            }}
          >
            <option value="">Toutes</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
        <label>
          Mode{' '}
          <select
            className="bg-background rounded border p-1"
            value={mode ?? ''}
            onChange={(e) => {
              setOffset(0);
              setMode((e.target.value || undefined) as typeof mode);
            }}
          >
            <option value="">Tous</option>
            <option value="practice">Pratique</option>
            <option value="full">Examen</option>
          </select>
        </label>
        {first && second && comparable && (
          <Button asChild size="sm" variant="primary">
            <Link href={`/comparer?a=${first.id}&b=${second.id}`}>Comparer la sélection</Link>
          </Button>
        )}
        {first && second && !comparable && (
          <p className="text-muted-foreground text-sm" role="status">
            Seules deux tentatives du même sujet peuvent être comparées.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-destructive mb-3">
          {error}
        </p>
      )}

      {items.length === 0 && !error ? (
        <p className="text-muted-foreground">Aucune tentative pour le moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Vos tentatives, de la plus récente à la plus ancienne
            </caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className="p-2">
                  <span className="sr-only">Comparer</span>
                </th>
                <th scope="col" className="p-2">
                  Date
                </th>
                <th scope="col" className="p-2">
                  Tâche
                </th>
                <th scope="col" className="p-2">
                  Mode
                </th>
                <th scope="col" className="p-2">
                  Durée
                </th>
                <th scope="col" className="p-2">
                  Niveau
                </th>
                <th scope="col" className="p-2">
                  Coût
                </th>
                <th scope="col" className="p-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      aria-label="Sélectionner pour comparer"
                      checked={selected.some((x) => x.id === a.id)}
                      onChange={() => toggle(a)}
                    />
                  </td>
                  <td className="p-2">
                    <Link href={`/resultats/${a.id}`} className="underline">
                      {new Date(a.startedAt).toLocaleString('fr-FR')}
                    </Link>
                  </td>
                  <td className="p-2">{TASK_LABELS[a.task]}</td>
                  <td className="p-2">{a.mode === 'full' ? 'Examen' : 'Pratique'}</td>
                  <td className="p-2">{formatDuration(a.durationS)}</td>
                  <td className="p-2">
                    {a.evaluationStatus === 'done' ? (
                      <LevelBadge level={a.globalLevel} />
                    ) : (
                      <span className="text-muted-foreground">
                        {a.evaluationStatus === 'failed' ? 'Échec' : 'En cours'}
                      </span>
                    )}
                  </td>
                  <td className="p-2">{formatCost(a.estimatedCostUsd)}</td>
                  <td className="p-2">
                    <Button size="sm" variant="ghost" onClick={() => void remove(a.id)}>
                      Supprimer
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 text-sm">
        <Button
          size="sm"
          variant="secondary"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
        >
          Précédent
        </Button>
        <span>
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} sur {total}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={offset + PAGE_SIZE >= total}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          Suivant
        </Button>
      </div>
    </PageShell>
  );
}
