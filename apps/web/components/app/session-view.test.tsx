import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APP_CONFIG_DEFAULTS, type Task } from '@/app-config';
import type { RealtimeExamContextValue } from '@/providers/realtime-exam-provider';
import { SessionView } from './session-view';

const ctx = vi.hoisted(() => {
  const state: { exam: unknown } = { exam: null };
  return state;
});

vi.mock('@/providers/realtime-exam-provider', () => ({
  useRealtimeExam: () => ctx.exam,
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
    isConnected: true,
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

const [TACHE1, TACHE2] = APP_CONFIG_DEFAULTS.tasks as [Task, Task, Task];

let mediaMatches: Record<string, boolean>;
let frames: FrameRequestCallback[];

function show(overrides: Partial<RealtimeExamContextValue> = {}, task: Task | null = TACHE1) {
  const exam = fakeExam(overrides);
  ctx.exam = exam;
  const view = render(<SessionView appConfig={APP_CONFIG_DEFAULTS} selectedTask={task} />);
  return { exam, ...view };
}

beforeEach(() => {
  mediaMatches = {};
  frames = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: mediaMatches[query] ?? false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => frames.push(cb))
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

describe('SessionView header', () => {
  it('shows the task title and the current phase', () => {
    show({ micEnabled: true, agentSpeaking: true });
    expect(screen.getByRole('heading', { name: 'Tâche 1' })).toBeInTheDocument();
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain(
      'L’examinateur parle'
    );
  });

  it('falls back to "Session" without a selected task', () => {
    show({}, null);
    expect(screen.getByRole('heading', { name: 'Session' })).toBeInTheDocument();
  });

  it('opens the shortcuts dialog from the keyboard button and with "?"', async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole('button', { name: 'Raccourcis clavier (?)' }));
    expect(await screen.findByRole('dialog', { name: 'Raccourcis clavier' })).toBeInTheDocument();
    expect(screen.getByText('Activer ou couper le micro')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.keyboard('?');
    expect(await screen.findByRole('dialog', { name: 'Raccourcis clavier' })).toBeInTheDocument();
  });
});

describe('microphone', () => {
  it('turns the mic on from the footer button', async () => {
    const user = userEvent.setup();
    const { exam } = show();
    const button = screen.getByRole('button', { name: 'Activer le micro (M)' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('Micro coupé');

    await user.click(button);
    expect(exam.setMicEnabled).toHaveBeenCalledWith(true);
  });

  it('turns the mic off when it is on', async () => {
    const user = userEvent.setup();
    const { exam } = show({ micEnabled: true });
    const button = screen.getByRole('button', { name: 'Couper le micro (M)' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('Micro activé');
    await user.click(button);
    expect(exam.setMicEnabled).toHaveBeenCalledWith(false);
  });

  it('toggles the mic with the M shortcut while connected', async () => {
    const user = userEvent.setup();
    const { exam } = show({ micEnabled: true });
    await user.keyboard('m');
    expect(exam.setMicEnabled).toHaveBeenCalledWith(false);
  });

  it('ignores the M shortcut while not connected', async () => {
    const user = userEvent.setup();
    const { exam } = show({ isConnected: false });
    await user.keyboard('m');
    expect(exam.setMicEnabled).not.toHaveBeenCalled();
  });

  it('shows the hint while the mic is off', () => {
    show();
    expect(screen.getByText('Micro désactivé')).toBeInTheDocument();
  });

  it('turns the mic off and removes the control once the task has ended', async () => {
    const user = userEvent.setup();
    const { exam } = show({ sessionEnded: true });
    expect(exam.setMicEnabled).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('button', { name: /micro \(M\)/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Micro désactivé')).not.toBeInTheDocument();
    expect(screen.getByText('Vous')).toBeInTheDocument();

    vi.mocked(exam.setMicEnabled).mockClear();
    await user.keyboard('m');
    expect(exam.setMicEnabled).not.toHaveBeenCalled();
  });
});

describe('session controls', () => {
  it('hangs up with "Raccrocher"', async () => {
    const user = userEvent.setup();
    const { exam } = show();
    await user.click(screen.getByRole('button', { name: /Raccrocher/ }));
    expect(exam.end).toHaveBeenCalledTimes(1);
  });

  it('disables hang up while not connected', () => {
    show({ isConnected: false });
    expect(screen.getByRole('button', { name: /Raccrocher/ })).toBeDisabled();
  });

  it('restarts the session', async () => {
    const user = userEvent.setup();
    const { exam } = show();
    await user.click(screen.getByRole('button', { name: 'Recommencer la session' }));
    expect(exam.restartExam).toHaveBeenCalledTimes(1);
  });

  it('moves between subjects when there is a list', async () => {
    const user = userEvent.setup();
    const { exam } = show({ orderedExerciseIds: ['a', 'b'] });
    const toolbar = screen.getByRole('toolbar', { name: 'Navigation entre les sujets' });

    await user.click(within(toolbar).getByRole('button', { name: /exercice précédent/ }));
    await user.click(within(toolbar).getByRole('button', { name: 'Autre sujet au hasard' }));
    await user.click(within(toolbar).getByRole('button', { name: /exercice suivant/ }));

    expect(vi.mocked(exam.goToAnotherExercise).mock.calls).toEqual([
      ['previous'],
      ['random'],
      ['next'],
    ]);
  });

  it.each([
    ['without a subject list', { orderedExerciseIds: [] }],
    ['while restarting', { orderedExerciseIds: ['a'], isRestarting: true }],
    ['while connecting', { orderedExerciseIds: ['a'], isConnecting: true }],
  ])('disables subject navigation %s', (_label, overrides) => {
    show(overrides);
    for (const name of [/exercice précédent/, 'Autre sujet au hasard', /exercice suivant/]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});

describe('instructions tab', () => {
  it('shows the subject description and its picture', () => {
    show({
      exerciseData: {
        title: 'T2',
        description: 'Vous cherchez un appartement.',
        imageUrl: 'https://img.example/doc.png',
      },
    });
    expect(screen.getByText('Vous cherchez un appartement.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Document du sujet' })).toHaveAttribute(
      'src',
      'https://img.example/doc.png'
    );
  });

  it('falls back to the task description', () => {
    show();
    expect(screen.getByText(TACHE1.description)).toBeInTheDocument();
  });

  it('shows a placeholder while the subject of tâche 2 loads', () => {
    show({}, TACHE2);
    expect(screen.queryByText(TACHE2.description)).not.toBeInTheDocument();
    expect(screen.queryByText('Micro désactivé')).not.toBeInTheDocument();
  });

  it('switches to the conversation and back to the instructions on restart', async () => {
    const user = userEvent.setup();
    const exam = fakeExam({
      transcripts: [{ id: 'l1', text: 'Je suis prête.', isLocal: true, timestamp: 1 }],
    });
    ctx.exam = exam;
    const { rerender } = render(
      <SessionView appConfig={APP_CONFIG_DEFAULTS} selectedTask={TACHE1} />
    );

    await user.click(screen.getByRole('tab', { name: 'Conversation' }));
    expect(screen.getByRole('tab', { name: 'Conversation' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    ctx.exam = { ...exam, restartSequence: 1 };
    rerender(<SessionView appConfig={APP_CONFIG_DEFAULTS} selectedTask={TACHE1} />);
    expect(screen.getByRole('tab', { name: 'Consigne' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('timer', () => {
  it('counts down to the speaking deadline and calls onTimeUp at 0', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
    const { exam } = show({ timeUpAt: Date.now() + 61_000 });
    const timer = screen.getByRole('timer', { name: 'Temps restant' });
    expect(timer).toHaveTextContent('01:01');

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(timer).toHaveTextContent('00:00');
    expect(exam.onTimeUp).toHaveBeenCalledTimes(1);
  });

  it('shows 00:00 before the task starts', () => {
    show();
    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent('00:00');
  });
});

describe('footer layout and voice indicators', () => {
  it('names the examiner indicator by whether it speaks', () => {
    show({ agentSpeaking: true });
    expect(screen.getByRole('status', { name: /^Évaluateur parle/ })).toBeInTheDocument();
  });

  it('says the examiner is silent otherwise', () => {
    show();
    expect(screen.getByRole('status', { name: /^Évaluateur, silence/ })).toBeInTheDocument();
  });

  it('shows the "Évaluateur" caption only on tall wide screens', () => {
    mediaMatches['(min-width: 640px)'] = true;
    show();
    expect(screen.getByText('Évaluateur')).toBeInTheDocument();
  });

  it('hides the caption on short screens and uses the compact footer', () => {
    mediaMatches['(min-width: 640px)'] = true;
    mediaMatches['(max-height: 700px)'] = true;
    mediaMatches['(min-width: 640px) and (max-height: 700px)'] = true;
    show();
    expect(screen.queryByText('Évaluateur')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Raccrocher/ })).toBeInTheDocument();
  });

  it('animates the level bars while the examiner speaks', () => {
    const levelRef = { current: 1 };
    show({ agentSpeaking: true, agentAudioLevelRef: levelRef });
    const indicator = screen.getByRole('status', { name: /^Évaluateur parle/ });
    const bars = indicator.querySelectorAll<HTMLSpanElement>('span.block');
    expect(bars).toHaveLength(5);

    for (let i = 0; i < 20 && frames.length > 0; i++) {
      act(() => {
        frames.shift()?.(0);
      });
    }
    const heights = [...bars].map((b) => parseFloat(b.style.height));
    expect(Math.max(...heights)).toBeGreaterThan(30);
    expect(Math.max(...heights)).toBeLessThanOrEqual(100);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(30);
  });

  it('keeps the bars at rest while silent', () => {
    show();
    const indicator = screen.getByRole('status', { name: /^Évaluateur, silence/ });
    const heights = [...indicator.querySelectorAll<HTMLSpanElement>('span.block')].map(
      (b) => b.style.height
    );
    expect(new Set(heights)).toEqual(new Set(['18%']));
  });
});
