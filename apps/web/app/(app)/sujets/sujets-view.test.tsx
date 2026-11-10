import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseListItem, ListExercisesOutput } from '@parle-tcf/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '@/lib/api';
import { SujetsView, monthLabel } from './sujets-view';

vi.mock('@/lib/api', () => ({
  api: { listExercises: vi.fn(), listExerciseSessions: vi.fn() },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/sujets',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }), signOut: vi.fn() },
}));

const listExercises = vi.mocked(api.listExercises);
const listSessions = vi.mocked(api.listExerciseSessions);

const SESSIONS = [
  { id: 12, year: 2026, month: 3, tache2: 12, tache3: 0 },
  { id: 11, year: 2026, month: 2, tache2: 8, tache3: 9 },
];

function item(overrides: Partial<ExerciseListItem> = {}): ExerciseListItem {
  return {
    id: 'sujet-1',
    task: 2,
    prompt: 'Vous cherchez un logement à Montréal.',
    firstSeenOn: '2025-11-01',
    lastSeenOn: '2026-03-01',
    timesPublished: 1,
    isImageBased: false,
    ...overrides,
  };
}

function page(items: ExerciseListItem[], total = items.length): ListExercisesOutput {
  return { items, total };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function lastQuery() {
  return listExercises.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  listExercises.mockReset();
  listSessions.mockReset();
  listSessions.mockResolvedValue({ sessions: SESSIONS });
  listExercises.mockResolvedValue(page([item()]));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup() {
  const user = userEvent.setup();
  render(<SujetsView />);
  return user;
}

describe('monthLabel', () => {
  it('names the month in French', () => {
    expect(monthLabel(2026, 1)).toBe('janvier 2026');
    expect(monthLabel(2025, 12)).toBe('décembre 2025');
  });
});

describe('SujetsView', () => {
  it('shows a placeholder, then the first page of tâche 2 subjects', async () => {
    setup();
    expect(screen.getByRole('status', { name: 'Chargement' })).toBeInTheDocument();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(listExercises).toHaveBeenCalledWith({
      task: 2,
      sessionId: undefined,
      search: undefined,
      limit: 20,
      offset: 0,
    });

    await flush();

    expect(screen.getByText('1 sujet')).toBeInTheDocument();
    expect(screen.getByText('Vous cherchez un logement à Montréal.')).toBeInTheDocument();
    expect(screen.getByText('Publié dernière fois en mars 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'S’entraîner sur ce sujet' })).toHaveAttribute(
      'href',
      '/tcf/tache2/sujet-1'
    );
    expect(screen.queryByText('Avec document')).not.toBeInTheDocument();
  });

  it('describes recurring and image-based subjects and encodes the link', async () => {
    listExercises.mockResolvedValue(
      page(
        [
          item({ id: 'a/b c', task: 3, timesPublished: 3, isImageBased: true }),
          item({ id: 'x', lastSeenOn: null, prompt: 'Sans date' }),
        ],
        2
      )
    );
    setup();
    await flush();

    expect(screen.getByText('2 sujets')).toBeInTheDocument();
    expect(screen.getByText('Publié 3 fois, dernière fois en mars 2026')).toBeInTheDocument();
    expect(screen.getByText('Avec document')).toBeInTheDocument();
    const [first, second] = screen.getAllByRole('link', { name: 'S’entraîner sur ce sujet' });
    expect(first).toHaveAttribute('href', '/tcf/tache3/a%2Fb%20c');
    expect(within(second.closest('li')!).queryByText(/Publié/)).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    listExercises.mockResolvedValue(page([], 0));
    setup();
    await flush();
    expect(screen.getByText('0 sujet')).toBeInTheDocument();
    expect(screen.getByText('Aucun sujet trouvé')).toBeInTheDocument();
  });

  it('shows an error when the list cannot load', async () => {
    listExercises.mockRejectedValue(new Error('500'));
    setup();
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger les sujets.');
    expect(screen.queryByText('Aucun sujet trouvé')).not.toBeInTheDocument();
  });

  it('switches to tâche 3 and only offers months that have tâche 3 subjects', async () => {
    const user = setup();
    await flush();
    const select = screen.getByRole('combobox', { name: 'Mois' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Tous les mois', 'mars 2026 (12)', 'février 2026 (8)']);

    await user.click(screen.getByRole('button', { name: 'Tâche 3' }));
    await flush();

    expect(screen.getByRole('button', { name: 'Tâche 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tâche 2' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(lastQuery()).toMatchObject({ task: 3, offset: 0 });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Tous les mois', 'février 2026 (9)']);
  });

  it('filters by month, and offers the latest month as a shortcut', async () => {
    const user = setup();
    await flush();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Mois' }), '11');
    await flush();
    expect(lastQuery()).toMatchObject({ sessionId: 11 });

    await user.click(screen.getByRole('button', { name: 'Sujets du mois (mars 2026)' }));
    await flush();
    expect(lastQuery()).toMatchObject({ sessionId: 12 });
    expect(
      screen.queryByRole('button', { name: 'Sujets du mois (mars 2026)' })
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Mois' }), '');
    await flush();
    expect(lastQuery()).toMatchObject({ sessionId: undefined });
  });

  it('works without the month list', async () => {
    listSessions.mockRejectedValue(new Error('offline'));
    setup();
    await flush();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Tous les mois']);
    expect(screen.queryByRole('button', { name: /Sujets du mois/ })).not.toBeInTheDocument();
  });

  it('searches 300 ms after typing stops, with trimmed keywords', async () => {
    vi.useFakeTimers();
    render(<SujetsView />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    listExercises.mockClear();
    const input = screen.getByRole('searchbox', { name: 'Rechercher' });

    fireEvent.change(input, { target: { value: ' loge' } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.change(input, { target: { value: ' logement ' } });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(listExercises).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(listExercises).toHaveBeenCalledTimes(1);
    expect(lastQuery()).toMatchObject({ search: 'logement', offset: 0 });

    fireEvent.change(input, { target: { value: '   ' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(lastQuery()).toMatchObject({ search: undefined });
  });

  it('pages through the results and goes back to page 1 when a filter changes', async () => {
    listExercises.mockResolvedValue(page([item()], 45));
    const user = setup();
    await flush();

    const pagination = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(pagination).getByText('Page 1 / 3')).toBeInTheDocument();
    expect(within(pagination).getByRole('button', { name: 'Précédent' })).toBeDisabled();

    await user.click(within(pagination).getByRole('button', { name: 'Suivant' }));
    await flush();
    expect(lastQuery()).toMatchObject({ offset: 20 });
    await user.click(within(pagination).getByRole('button', { name: 'Suivant' }));
    await flush();
    expect(lastQuery()).toMatchObject({ offset: 40 });
    expect(within(pagination).getByText('Page 3 / 3')).toBeInTheDocument();
    expect(within(pagination).getByRole('button', { name: 'Suivant' })).toBeDisabled();

    await user.click(within(pagination).getByRole('button', { name: 'Précédent' }));
    await flush();
    expect(lastQuery()).toMatchObject({ offset: 20 });

    await user.click(screen.getByRole('button', { name: 'Tâche 3' }));
    await flush();
    expect(lastQuery()).toMatchObject({ task: 3, offset: 0 });
  });

  it('has no pagination for a single page', async () => {
    listExercises.mockResolvedValue(page([item()], 20));
    setup();
    await flush();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('ignores the answer of a request that is no longer current', async () => {
    let resolveFirst!: (value: ListExercisesOutput) => void;
    listExercises
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue(page([item({ prompt: 'Sujet de tâche 3', task: 3 })]));
    const user = setup();

    await user.click(screen.getByRole('button', { name: 'Tâche 3' }));
    await flush();
    resolveFirst(page([item({ prompt: 'Ancien sujet' })]));
    await flush();

    expect(screen.getByText('Sujet de tâche 3')).toBeInTheDocument();
    expect(screen.queryByText('Ancien sujet')).not.toBeInTheDocument();
  });
});
