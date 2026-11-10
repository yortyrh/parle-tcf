import type { ReactNode } from 'react';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttemptSummary, ExamRun } from '@parle-tcf/shared';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toastAlert } from '@/components/ui/alert-toast';
import { api } from '@/lib/api';
import type { RealtimeExamContextValue } from '@/providers/realtime-exam-provider';
import { ExamRunApp } from './exam-run-app';

const h = vi.hoisted(() => {
  const state: { exam: unknown; push: Mock } = { exam: null, push: vi.fn() };
  return state;
});

vi.mock('@/providers/realtime-exam-provider', () => ({
  RealtimeExamProvider: ({ children }: { children: ReactNode }) => children,
  useRealtimeExam: () => h.exam,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/examen',
  useRouter: () => ({ push: h.push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/api', () => ({ api: { getRun: vi.fn() } }));
vi.mock('@/lib/auth-client', () => ({ authClient: {} }));
vi.mock('@/components/ui/alert-toast', () => ({ toastAlert: vi.fn() }));

const RUN = '33333333-3333-4333-8333-333333333333';
const getRun = vi.mocked(api.getRun);

function fakeExam(overrides: Partial<RealtimeExamContextValue> = {}): RealtimeExamContextValue {
  return {
    attemptId: null,
    runId: null,
    mode: 'full',
    needsProviderKey: false,
    preparation: null,
    skipPreparation: vi.fn(),
    timeUpAt: null,
    attemptCompleted: false,
    sessionClosed: false,
    onTimeUp: vi.fn(),
    finishTask: vi.fn(),
    isConnected: false,
    isConnecting: false,
    isRestarting: false,
    fatalError: null,
    sessionError: null,
    start: vi.fn(() => Promise.resolve()),
    end: vi.fn(),
    micEnabled: false,
    setMicEnabled: vi.fn(),
    agentSpeaking: false,
    userSpeaking: false,
    agentAudioLevelRef: { current: 0 },
    userAudioLevelRef: { current: 0 },
    exerciseData: null,
    sessionEnded: false,
    resetSessionEnd: vi.fn(),
    transcripts: [],
    orderedExerciseIds: [],
    goToAnotherExercise: vi.fn(),
    sessionId: null,
    restartSequence: 0,
    restartExam: vi.fn(),
    ...overrides,
  };
}

function summary(task: number, overrides: Partial<AttemptSummary> = {}): AttemptSummary {
  return {
    id: `att-${task}`,
    runId: RUN,
    mode: 'full',
    task,
    exerciseId: null,
    status: 'completed',
    evaluationStatus: 'done',
    startedAt: '2026-03-01T10:00:00Z',
    finishedAt: '2026-03-01T10:05:00Z',
    durationS: 120,
    model: 'gpt-realtime-mini',
    globalLevel: 'B1',
    estimatedCostUsd: 0.1,
    ...overrides,
  };
}

function run(overrides: Partial<ExamRun> = {}): ExamRun {
  return {
    id: RUN,
    mode: 'full',
    startedAt: '2026-03-01T10:00:00Z',
    finishedAt: '2026-03-01T10:20:00Z',
    globalLevel: null,
    attempts: [summary(1), summary(2), summary(3)],
    ...overrides,
  };
}

function setup(overrides: Partial<RealtimeExamContextValue> = {}) {
  let exam = fakeExam(overrides);
  h.exam = exam;
  const view = render(<ExamRunApp />);
  return {
    ...view,
    get exam() {
      return exam;
    },
    update(next: Partial<RealtimeExamContextValue>) {
      exam = { ...exam, ...next };
      h.exam = exam;
      view.rerender(<ExamRunApp />);
    },
  };
}

beforeEach(() => {
  h.push.mockReset();
  getRun.mockReset();
  vi.mocked(toastAlert).mockReset();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1)
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
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
  // Unmount while the stubbed browser APIs still exist.
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('intro screen', () => {
  it('presents the three tasks with their official times and an estimated cost', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Examen complet' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Tâche 1expression 2 min',
      'Tâche 2préparation 2 min · expression 3 min 30',
      'Tâche 3expression 4 min 30',
    ]);
    expect(screen.getByText(/Coût estimé : environ \d+,\d{2} \$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Entraînement libre' })).toHaveAttribute(
      'href',
      '/tcf'
    );
  });

  it('starts task 1 in full-exam mode', async () => {
    const user = userEvent.setup();
    const t = setup();
    await user.click(screen.getByRole('button', { name: "Commencer l'examen" }));
    expect(t.exam.start).toHaveBeenCalledWith('tache1', undefined, {
      mode: 'full',
      runId: undefined,
    });
    expect(screen.getByRole('status', { name: 'Connexion à l’examinateur…' })).toBeInTheDocument();
  });

  it('sends the candidate to the settings when no provider key is set', () => {
    setup({ needsProviderKey: true });
    expect(h.push).toHaveBeenCalledWith('/parametres');
  });
});

describe('running the exam', () => {
  async function startExam() {
    const user = userEvent.setup();
    const t = setup();
    await user.click(screen.getByRole('button', { name: "Commencer l'examen" }));
    return { user, ...t };
  }

  it('shows the live session with the task counter', async () => {
    const t = await startExam();
    t.update({ isConnected: true, runId: RUN });
    expect(screen.getByText('Examen · tâche 1/3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tâche suivante' })).not.toBeInTheDocument();
  });

  it('shows the preparation of tâche 2', async () => {
    const t = await startExam();
    t.update({
      preparation: { secondsLeft: 30 },
      exerciseData: { title: 'T2', description: 'Situation' },
    });
    expect(screen.getByRole('timer', { name: 'Temps de préparation restant' })).toHaveTextContent(
      '00:30'
    );
    expect(screen.getByText('Situation')).toBeInTheDocument();
  });

  it('chains the next task in the same run once the task is saved', async () => {
    const t = await startExam();
    t.update({ isConnected: true, runId: RUN });
    t.update({ attemptCompleted: true });

    await t.user.click(screen.getByRole('button', { name: 'Tâche suivante' }));

    expect(t.exam.end).toHaveBeenCalled();
    expect(t.exam.start).toHaveBeenLastCalledWith('tache2', undefined, {
      mode: 'full',
      runId: RUN,
    });
  });

  it('offers to continue once the connection closed after the task', async () => {
    const t = await startExam();
    t.update({ isConnected: true, runId: RUN });
    t.update({ isConnected: false, attemptCompleted: true });

    expect(screen.getByRole('heading', { name: 'Tâche 1 terminée' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recommencer la tâche' })).not.toBeInTheDocument();
    await t.user.click(screen.getByRole('button', { name: 'Tâche suivante' }));
    expect(t.exam.start).toHaveBeenLastCalledWith('tache2', undefined, {
      mode: 'full',
      runId: RUN,
    });
  });

  it('offers to restart or skip a task interrupted by a network drop', async () => {
    const t = await startExam();
    t.update({ isConnected: false, sessionClosed: true });

    expect(screen.getByRole('heading', { name: 'Session interrompue' })).toBeInTheDocument();
    expect(
      screen.getByText('La connexion avec l’examinateur a été coupée avant la fin de la tâche.')
    ).toBeInTheDocument();
    await t.user.click(screen.getByRole('button', { name: 'Recommencer la tâche' }));
    expect(t.exam.restartExam).toHaveBeenCalledTimes(1);
  });

  it('goes back to the intro screen when a task fails to start', async () => {
    const t = await startExam();
    t.update({ fatalError: 'Impossible de joindre le serveur.' });
    expect(screen.getByRole('heading', { name: 'Examen complet' })).toBeInTheDocument();
    expect(toastAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Session impossible' })
    );
    expect(t.exam.end).toHaveBeenCalled();
  });

  it('waits for the connection before leaving the task on error', async () => {
    const t = await startExam();
    t.update({ fatalError: 'Erreur', isConnecting: true });
    expect(screen.queryByRole('heading', { name: 'Examen complet' })).not.toBeInTheDocument();
  });
});

describe('end of the exam', () => {
  /** Runs the three tasks; `fakeTimers` switches to fake timers before the results load. */
  async function finishExam({ fakeTimers = false } = {}) {
    const user = userEvent.setup();
    const t = setup();
    await user.click(screen.getByRole('button', { name: "Commencer l'examen" }));
    t.update({ isConnected: true, runId: RUN, attemptCompleted: true });
    await user.click(screen.getByRole('button', { name: 'Tâche suivante' }));
    t.update({ attemptCompleted: true });
    await user.click(screen.getByRole('button', { name: 'Tâche suivante' }));
    t.update({ attemptCompleted: true });
    const finish = screen.getByRole('button', { name: "Terminer l'examen" });
    if (fakeTimers) {
      vi.useFakeTimers();
      act(() => finish.click());
    } else {
      await user.click(finish);
    }
    return { user, ...t };
  }

  it('shows the overall level and each task once graded', async () => {
    getRun.mockResolvedValue(
      run({
        globalLevel: 'B2',
        attempts: [
          summary(1, { globalLevel: 'B1' }),
          summary(2, { evaluationStatus: 'failed', globalLevel: null }),
          summary(3, { globalLevel: 'C1' }),
        ],
      })
    );
    const t = await finishExam();

    expect(screen.getByRole('heading', { name: 'Examen terminé' })).toBeInTheDocument();
    expect(t.exam.start).toHaveBeenCalledTimes(3);
    expect(await screen.findByLabelText('Niveau B2')).toBeInTheDocument();
    expect(getRun).toHaveBeenCalledWith(RUN);

    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByRole('link', { name: 'Tâche 1 · Entretien' })).toHaveAttribute(
      'href',
      '/resultats/att-1'
    );
    expect(within(rows[1]).getByText('évaluation échouée')).toBeInTheDocument();
    expect(within(rows[2]).getByLabelText('Niveau C1')).toBeInTheDocument();
  });

  it('polls the run every 5 s until every task is graded', async () => {
    getRun
      .mockResolvedValueOnce(run({ attempts: [summary(1, { evaluationStatus: 'running' })] }))
      .mockResolvedValueOnce(run({ globalLevel: 'B1' }));
    await finishExam({ fakeTimers: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('en cours d’évaluation…')).toBeInTheDocument();
    expect(getRun).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4999);
    });
    expect(getRun).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(getRun).toHaveBeenCalledTimes(2);
    expect(screen.getAllByLabelText('Niveau B1').length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getRun).toHaveBeenCalledTimes(2);
  });

  it('stops polling when every evaluation settled without an overall level', async () => {
    getRun.mockResolvedValue(
      run({ attempts: [summary(1, { evaluationStatus: 'failed', globalLevel: null })] })
    );
    await finishExam({ fakeTimers: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getRun).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed load', async () => {
    getRun
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(run({ globalLevel: 'A2' }));
    await finishExam({ fakeTimers: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Chargement des résultats…');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(getRun).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Niveau A2')).toBeInTheDocument();
  });

  it('offers another exam, the history and free practice', async () => {
    getRun.mockResolvedValue(run({ globalLevel: 'B1' }));
    const t = await finishExam();
    expect(screen.getByRole('link', { name: "Voir l'historique" })).toHaveAttribute(
      'href',
      '/historique'
    );
    expect(screen.getByRole('link', { name: 'Entraînement libre' })).toHaveAttribute(
      'href',
      '/tcf'
    );

    await t.user.click(screen.getByRole('button', { name: 'Refaire un examen' }));
    expect(screen.getByRole('heading', { name: 'Examen complet' })).toBeInTheDocument();
  });

  it('shows no result without a run id', async () => {
    const user = userEvent.setup();
    const t = setup();
    await user.click(screen.getByRole('button', { name: "Commencer l'examen" }));
    for (const label of ['Tâche suivante', 'Tâche suivante', "Terminer l'examen"]) {
      t.update({ isConnected: false, sessionClosed: true });
      await user.click(screen.getByRole('button', { name: label }));
    }
    expect(screen.getByRole('heading', { name: 'Examen terminé' })).toBeInTheDocument();
    expect(getRun).not.toHaveBeenCalled();
    expect(screen.queryByText('Chargement des résultats…')).not.toBeInTheDocument();
  });
});
