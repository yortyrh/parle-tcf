import type { ComponentProps } from 'react';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APP_CONFIG_DEFAULTS } from '@/app-config';
import type { RealtimeExamContextValue } from '@/providers/realtime-exam-provider';
import { ViewController } from './view-controller';

const h = vi.hoisted(() => {
  const state: { exam: unknown; pathname: string; push: Mock; replace: Mock } = {
    exam: null,
    pathname: '/tcf',
    push: vi.fn(),
    replace: vi.fn(),
  };
  return state;
});

vi.mock('@/providers/realtime-exam-provider', () => ({
  useRealtimeExam: () => h.exam,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => h.pathname,
  useRouter: () => ({ push: h.push, replace: h.replace, refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
    signOut: vi.fn(),
  },
}));

function fakeExam(overrides: Partial<RealtimeExamContextValue> = {}): RealtimeExamContextValue {
  return {
    attemptId: null,
    runId: null,
    mode: 'practice',
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
    start: vi.fn(),
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

type Props = Partial<ComponentProps<typeof ViewController>>;

function setup(examOverrides: Partial<RealtimeExamContextValue> = {}, props: Props = {}) {
  let exam = fakeExam(examOverrides);
  h.exam = exam;
  const onTaskSelect = vi.fn();
  const taskRef = { current: 'tache1' };
  const exerciseRef: { current: string | undefined } = { current: undefined };
  const element = (p: Props) => (
    <ViewController
      appConfig={APP_CONFIG_DEFAULTS}
      connectTaskTypeRef={taskRef}
      connectExerciseIdRef={exerciseRef}
      onTaskSelect={onTaskSelect}
      {...p}
    />
  );
  const view = render(element(props));
  return {
    ...view,
    onTaskSelect,
    taskRef,
    exerciseRef,
    get exam() {
      return exam;
    },
    update(overrides: Partial<RealtimeExamContextValue>, nextProps: Props = props) {
      exam = { ...exam, ...overrides };
      h.exam = exam;
      view.rerender(element(nextProps));
    },
  };
}

beforeEach(() => {
  h.pathname = '/tcf';
  h.push.mockReset();
  h.replace.mockReset();
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
});

describe('ViewController screens', () => {
  it('shows the welcome screen when idle', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'S’entraîner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeDisabled();
  });

  it.each([{ isConnecting: true }, { isRestarting: true }])(
    'shows the connecting skeleton (%o)',
    (state) => {
      setup(state);
      expect(
        screen.getByRole('status', { name: 'Connexion à l’examinateur…' })
      ).toBeInTheDocument();
    }
  );

  it('shows the preparation with the subject, and skips it on demand', async () => {
    const user = userEvent.setup();
    const { exam } = setup({
      preparation: { secondsLeft: 75 },
      exerciseData: { title: 'T2', description: 'desc', content: 'Vous cherchez un logement.' },
    });
    expect(screen.getByRole('timer', { name: 'Temps de préparation restant' })).toHaveTextContent(
      '01:15'
    );
    expect(screen.getByText('Vous cherchez un logement.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Je suis prêt(e)' }));
    expect(exam.skipPreparation).toHaveBeenCalledTimes(1);
  });

  it('falls back to the subject description during the preparation', () => {
    setup({
      preparation: { secondsLeft: 5 },
      exerciseData: { title: 'T2', description: 'Situation du jeu de rôle' },
    });
    expect(screen.getByText('Situation du jeu de rôle')).toBeInTheDocument();
  });

  it('shows the live session once connected', () => {
    setup({ isConnected: true }, { initialTaskType: 'tache3' });
    expect(screen.getByRole('heading', { name: 'Tâche 3' })).toBeInTheDocument();
  });
});

describe('starting a task', () => {
  it('starts the selected task from the welcome screen', async () => {
    const user = userEvent.setup();
    const { exam, onTaskSelect, taskRef, exerciseRef } = setup();

    await user.click(screen.getByRole('radio', { name: /Tâche 2/ }));
    expect(screen.getByRole('radio', { name: /Tâche 2/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    expect(exam.start).toHaveBeenCalledWith('tache2', undefined);
    expect(onTaskSelect).toHaveBeenCalledWith('tache2');
    expect(taskRef.current).toBe('tache2');
    expect(exerciseRef.current).toBeUndefined();
  });

  it('navigates to the task route when routing by task', async () => {
    const user = userEvent.setup();
    const { exam } = setup({}, { routeByTask: true, welcomeHref: '/tcf' });

    await user.click(screen.getByRole('radio', { name: /Tâche 3/ }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    expect(h.push).toHaveBeenCalledWith('/tcf/tache3');
    expect(exam.start).not.toHaveBeenCalled();
  });

  it('starts directly when already on the task route', async () => {
    const user = userEvent.setup();
    h.pathname = '/tcf/tache2/';
    const { exam } = setup({}, { routeByTask: true, welcomeHref: '/tcf' });

    await user.click(screen.getByRole('radio', { name: /Tâche 2/ }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    expect(exam.start).toHaveBeenCalledWith('tache2', undefined);
    expect(h.push).not.toHaveBeenCalled();
  });

  it('connects automatically to the task and subject of the URL, once', () => {
    const { exam, update } = setup({}, { initialTaskType: 'tache3', initialExerciseId: 'ex-7' });
    expect(exam.start).toHaveBeenCalledWith('tache3', 'ex-7');

    update({ isConnecting: true }, { initialTaskType: 'tache3', initialExerciseId: 'ex-7' });
    update({ isConnecting: false }, { initialTaskType: 'tache3', initialExerciseId: 'ex-7' });
    expect(exam.start).toHaveBeenCalledTimes(1);
  });

  it('pre-selects the task of the URL on the welcome screen', () => {
    setup({}, { initialTaskType: 'tache2' });
    expect(screen.getByRole('radio', { name: /Tâche 2/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeEnabled();
  });

  it('ignores an unknown task type', () => {
    const { exam } = setup({}, { initialTaskType: 'tache9' });
    expect(exam.start).not.toHaveBeenCalled();
  });

  it('sends the candidate to the settings when no provider key is set', () => {
    setup({ needsProviderKey: true });
    expect(h.push).toHaveBeenCalledWith('/parametres');
  });
});

describe('leaving a session', () => {
  it('opens the result of the saved practice attempt after hang-up', () => {
    const t = setup({ isConnected: true }, { welcomeHref: '/tcf' });
    t.update({ attemptCompleted: true, attemptId: 'att-1', mode: 'practice' });
    t.update({ isConnected: false, attemptCompleted: false, attemptId: null });
    expect(h.replace).toHaveBeenCalledWith('/resultats/att-1');
  });

  it('goes back to the welcome page when nothing was saved', () => {
    const t = setup({ isConnected: true }, { welcomeHref: '/tcf' });
    t.update({ isConnected: false });
    expect(h.replace).toHaveBeenCalledWith('/tcf');
  });

  it('does not open the result of a full-exam attempt', () => {
    const t = setup({ isConnected: true }, { welcomeHref: '/tcf' });
    t.update({ attemptCompleted: true, attemptId: 'att-1', mode: 'full' });
    t.update({ isConnected: false });
    expect(h.replace).toHaveBeenCalledWith('/tcf');
  });

  it('stays put while restarting', () => {
    const t = setup({ isConnected: true }, { welcomeHref: '/tcf' });
    t.update({ isConnected: false, isRestarting: true });
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('stays put without a welcome page', () => {
    const t = setup({ isConnected: true });
    t.update({ isConnected: false });
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('ends the session on unmount', () => {
    const t = setup({ isConnected: true });
    t.unmount();
    expect(t.exam.end).toHaveBeenCalled();
  });
});

describe('WelcomeView', () => {
  it('lists the tasks with their official timings', () => {
    setup();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveTextContent('2 min');
    expect(radios[1]).toHaveTextContent('2 min de préparation + 3 min 30');
    expect(radios[2]).toHaveTextContent('4 min 30');
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('shows a back link when given a home page', () => {
    setup({}, { homeHref: '/tableau-de-bord' });
    expect(screen.getByRole('link', { name: '← Retour' })).toHaveAttribute(
      'href',
      '/tableau-de-bord'
    );
  });
});
