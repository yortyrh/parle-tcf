import type { ReactNode } from 'react';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APP_CONFIG_DEFAULTS } from '@/app-config';
import { toastAlert } from '@/components/ui/alert-toast';
import { App } from './app';

const h = vi.hoisted(() => {
  const state: { exam: Record<string, unknown>; push: Mock } = { exam: {}, push: vi.fn() };
  return state;
});

vi.mock('@/providers/realtime-exam-provider', () => ({
  RealtimeExamProvider: ({ children }: { children: ReactNode }) => children,
  useRealtimeExam: () => h.exam,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/tcf',
  useRouter: () => ({ push: h.push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }), signOut: vi.fn() },
}));
vi.mock('@/components/ui/alert-toast', () => ({ toastAlert: vi.fn() }));

beforeEach(() => {
  h.exam = {
    isConnected: false,
    isConnecting: false,
    isRestarting: false,
    preparation: null,
    fatalError: null,
    needsProviderKey: false,
    attemptCompleted: false,
    start: vi.fn(),
    end: vi.fn(),
  };
  vi.mocked(toastAlert).mockReset();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
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
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the task picker and starts the chosen task', async () => {
    render(<App appConfig={APP_CONFIG_DEFAULTS} />);
    expect(screen.getByRole('heading', { name: 'S’entraîner' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Tâche 1/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Commencer' }));
    expect(h.exam.start).toHaveBeenCalledWith('tache1', undefined);
  });

  it('starts the task and subject given by the route', () => {
    render(
      <App appConfig={APP_CONFIG_DEFAULTS} initialTaskType="tache3" initialExerciseId="ex-4" />
    );
    expect(h.exam.start).toHaveBeenCalledWith('tache3', 'ex-4');
  });

  it('reports a fatal error and ends the session', () => {
    h.exam.fatalError = 'Micro refusé';
    render(<App appConfig={APP_CONFIG_DEFAULTS} />);
    expect(toastAlert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Session impossible' })
    );
    expect(h.exam.end).toHaveBeenCalled();
  });
});
