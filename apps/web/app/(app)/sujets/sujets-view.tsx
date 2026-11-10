'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ExerciseListItem, ExerciseSession } from '@parle-tcf/shared';
import { PageShell } from '@/components/app/page-shell';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

const PAGE_SIZE = 20;
const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export const monthLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;

type Task = 2 | 3;

/** Topic browser: pick a published subject by month, task and keywords, then practise it. */
export function SujetsView() {
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [task, setTask] = useState<Task>(2);
  const [sessionId, setSessionId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    api
      .listExerciseSessions()
      .then(({ sessions: list }) => setSessions(list))
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(0), [task, sessionId, query]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    api
      .listExercises({
        task,
        sessionId,
        search: query || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setTotal(result.total);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [task, sessionId, query, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const latest = sessions[0];
  const sessionOptions = useMemo(
    () => sessions.filter((s) => (task === 2 ? s.tache2 : s.tache3) > 0),
    [sessions, task]
  );

  return (
    <PageShell title="Sujets">
      <p className="text-muted-foreground mb-4 text-sm">
        Choisissez un sujet publié pour vous entraîner. Les sujets qui reviennent d’un mois à
        l’autre n’apparaissent qu’une fois.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Tâche" className="flex gap-2">
          {([2, 3] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={task === t ? 'primary' : 'outline'}
              aria-pressed={task === t}
              onClick={() => setTask(t)}
            >
              Tâche {t}
            </Button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Mois
          <select
            className="border-input bg-background h-9 rounded-md border px-2"
            value={sessionId ?? ''}
            onChange={(e) => setSessionId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Tous les mois</option>
            {sessionOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {monthLabel(s.year, s.month)} ({task === 2 ? s.tache2 : s.tache3})
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="sujets-search" className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          Rechercher
          <Input
            id="sujets-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="logement, travail, voyage…"
          />
        </label>
        {latest && sessionId !== latest.id && (
          <Button type="button" variant="link" onClick={() => setSessionId(latest.id)}>
            Sujets du mois ({monthLabel(latest.year, latest.month)})
          </Button>
        )}
      </div>

      <p className="text-muted-foreground mb-2 text-sm" role="status" aria-live="polite">
        {status === 'loading'
          ? 'Chargement…'
          : status === 'error'
            ? 'Impossible de charger les sujets.'
            : `${total} sujet${total > 1 ? 's' : ''}`}
      </p>

      {status === 'loading' && items.length === 0 && <ListSkeleton rows={5} />}
      {status === 'error' && <ErrorState message="Impossible de charger les sujets." />}
      {status === 'ready' && total === 0 && (
        <EmptyState
          title="Aucun sujet trouvé"
          description="Essayez un autre mot-clé, une autre tâche ou un autre mois."
        />
      )}

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="bg-card rounded-xl border p-4">
            <p className="leading-relaxed">{item.prompt}</p>
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {item.lastSeenOn && (
                <span>
                  Publié {item.timesPublished > 1 ? `${item.timesPublished} fois, ` : ''}dernière
                  fois en{' '}
                  {monthLabel(
                    Number(item.lastSeenOn.slice(0, 4)),
                    Number(item.lastSeenOn.slice(5, 7))
                  )}
                </span>
              )}
              {item.isImageBased && <span>Avec document</span>}
              <Link
                href={`/tcf/tache${item.task}/${encodeURIComponent(item.id)}`}
                className="text-primary ml-auto font-medium underline"
              >
                S’entraîner sur ce sujet
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Précédent
          </Button>
          <span className="text-sm">
            Page {page + 1} / {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </nav>
      )}

      <p className="text-muted-foreground mt-6 text-xs">
        Source des sujets : reussir-tcfcanada.com. parle-tcf n’est pas affilié à ce site.
      </p>
    </PageShell>
  );
}
