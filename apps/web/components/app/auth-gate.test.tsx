import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { authClient } from '@/lib/auth-client';
import { getSessionToken } from '@/lib/session-token';
import { AuthGate } from './auth-gate';

const nav = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/sujets',
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: vi.fn() } }));
vi.mock('@/lib/session-token', () => ({ getSessionToken: vi.fn(() => null) }));

const useSession = vi.mocked(authClient.useSession);
const storedToken = vi.mocked(getSessionToken);

function sessionState(state: { data: unknown; isPending: boolean; refetch?: () => Promise<void> }) {
  useSession.mockReturnValue(state as ReturnType<typeof authClient.useSession>);
}

/** A refetch the test settles by hand. */
function deferredRefetch() {
  let settle!: () => void;
  const refetch = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        settle = resolve;
      })
  );
  return {
    refetch,
    async finish() {
      await act(async () => {
        settle();
        await Promise.resolve();
      });
    },
  };
}

beforeEach(() => {
  nav.replace.mockReset();
  storedToken.mockReset();
  storedToken.mockReturnValue(null);
});

describe('AuthGate', () => {
  it('shows a loader while the session loads, without redirecting', () => {
    sessionState({ data: null, isPending: true });
    render(<AuthGate>contenu privé</AuthGate>);
    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    expect(screen.queryByText('contenu privé')).not.toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor to the login page with the current path', () => {
    sessionState({ data: null, isPending: false });
    render(<AuthGate>contenu privé</AuthGate>);
    expect(nav.replace).toHaveBeenCalledWith('/connexion?next=%2Fsujets');
    expect(screen.queryByText('contenu privé')).not.toBeInTheDocument();
  });

  it('renders the page for a signed-in user', () => {
    sessionState({ data: { user: { id: 'u1' } }, isPending: false });
    render(<AuthGate>contenu privé</AuthGate>);
    expect(screen.getByText('contenu privé')).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('renders the page without refetching when a token is stored and the session is loaded', () => {
    storedToken.mockReturnValue('tok');
    const refetch = vi.fn(() => Promise.resolve());
    sessionState({ data: { user: { id: 'u1' } }, isPending: false, refetch });
    render(<AuthGate>contenu privé</AuthGate>);
    expect(screen.getByText('contenu privé')).toBeInTheDocument();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('redirects at once without a stored token, without refetching', () => {
    const refetch = vi.fn(() => Promise.resolve());
    sessionState({ data: null, isPending: false, refetch });
    render(<AuthGate>contenu privé</AuthGate>);
    expect(refetch).not.toHaveBeenCalled();
    expect(nav.replace).toHaveBeenCalledWith('/connexion?next=%2Fsujets');
  });

  describe('with a stored token but a cached signed-out session (sign-in again in the same tab)', () => {
    beforeEach(() => {
      storedToken.mockReturnValue('tok-after-sign-in');
    });

    it('refetches the session and keeps showing the loader without redirecting', () => {
      const { refetch } = deferredRefetch();
      sessionState({ data: null, isPending: false, refetch });

      render(<AuthGate>contenu privé</AuthGate>);

      expect(refetch).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
      expect(screen.queryByText('contenu privé')).not.toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalled();
    });

    it('renders the page when the refetch finds the session', async () => {
      const pending = deferredRefetch();
      sessionState({ data: null, isPending: false, refetch: pending.refetch });
      const { rerender } = render(<AuthGate>contenu privé</AuthGate>);

      sessionState({ data: { user: { id: 'u1' } }, isPending: false, refetch: pending.refetch });
      await pending.finish();
      rerender(<AuthGate>contenu privé</AuthGate>);

      expect(screen.getByText('contenu privé')).toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalled();
    });

    it('redirects to the login page when the session is still null after the refetch', async () => {
      const pending = deferredRefetch();
      sessionState({ data: null, isPending: false, refetch: pending.refetch });
      render(<AuthGate>contenu privé</AuthGate>);
      expect(nav.replace).not.toHaveBeenCalled();

      await pending.finish();

      expect(nav.replace).toHaveBeenCalledWith('/connexion?next=%2Fsujets');
      expect(pending.refetch).toHaveBeenCalledTimes(1);
    });

    it('refetches only once per mount', async () => {
      const pending = deferredRefetch();
      sessionState({ data: null, isPending: false, refetch: pending.refetch });
      const { rerender } = render(<AuthGate>contenu privé</AuthGate>);
      rerender(<AuthGate>contenu privé</AuthGate>);
      rerender(<AuthGate>autre contenu</AuthGate>);
      expect(pending.refetch).toHaveBeenCalledTimes(1);

      await pending.finish();
      rerender(<AuthGate>contenu privé</AuthGate>);

      expect(pending.refetch).toHaveBeenCalledTimes(1);
    });
  });
});
