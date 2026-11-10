import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authClient } from '@/lib/auth-client';
import { SESSION_TOKEN_KEY } from '@/lib/session-token';
import { APP_NAV, AppHeader } from './app-shell';
import { PageShell } from './page-shell';

const nav = vi.hoisted(() => ({
  pathname: '/tableau-de-bord',
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: vi.fn(), signOut: vi.fn() },
}));

const useSession = vi.mocked(authClient.useSession);
const signOut = vi.mocked(authClient.signOut);

function session(user: { name: string; email: string } | null) {
  useSession.mockReturnValue({
    data: user ? { user, session: {} } : null,
    isPending: false,
  } as unknown as ReturnType<typeof authClient.useSession>);
}

beforeEach(() => {
  nav.pathname = '/tableau-de-bord';
  nav.replace.mockReset();
  signOut.mockReset();
  session({ name: 'Ana Lopez', email: 'ana@example.fr' });
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
  window.localStorage.clear();
});

function desktopNav() {
  return screen.getAllByRole('navigation', { name: 'Navigation principale' })[0];
}

describe('AppHeader navigation', () => {
  it('links every section of the app', () => {
    render(<AppHeader />);
    const links = within(desktopNav()).getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual(
      APP_NAV.map((item) => [item.label, item.href])
    );
  });

  it.each([
    ['/sujets', 'Sujets'],
    ['/tcf/tache2/abc', 'S’entraîner'],
    ['/historique', 'Historique'],
  ])('marks the current section on %s', (pathname, label) => {
    nav.pathname = pathname;
    render(<AppHeader />);
    const current = within(desktopNav()).getAllByRole('link', { current: 'page' });
    expect(current.map((l) => l.textContent)).toEqual([label]);
  });

  it('does not mark a section whose path is only a prefix of the current one', () => {
    nav.pathname = '/tcfx';
    render(<AppHeader />);
    expect(within(desktopNav()).queryAllByRole('link', { current: 'page' })).toEqual([]);
  });

  it('offers a skip link to the content', () => {
    render(<AppHeader />);
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute(
      'href',
      '#contenu'
    );
  });

  it('opens the mobile menu and closes it after choosing a section', async () => {
    const user = userEvent.setup();
    render(<AppHeader />);

    await user.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Menu')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('link', { name: 'Historique' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('AppHeader account menu', () => {
  it('shows the initials of the name and the email in the label', () => {
    render(<AppHeader />);
    const trigger = screen.getByRole('button', { name: 'Menu du compte (ana@example.fr)' });
    expect(trigger).toHaveTextContent('AL');
  });

  it('falls back to the email for the initials', () => {
    session({ name: '  ', email: 'jean.dupont@example.fr' });
    render(<AppHeader />);
    expect(screen.getByRole('button', { name: /Menu du compte/ })).toHaveTextContent('JD');
  });

  it('shows a placeholder while the session loads', () => {
    session(null);
    render(<AppHeader />);
    expect(screen.getByRole('button', { name: 'Menu du compte' })).toHaveTextContent('…');
  });

  it('lists the account entries', async () => {
    const user = userEvent.setup();
    render(<AppHeader />);
    await user.click(screen.getByRole('button', { name: /Menu du compte/ }));

    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Ana Lopez')).toBeInTheDocument();
    expect(within(menu).getByText('ana@example.fr')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /Paramètres/ })).toHaveAttribute(
      'href',
      '/parametres'
    );
    expect(within(menu).getByRole('menuitem', { name: /Confidentialité/ })).toHaveAttribute(
      'href',
      '/confidentialite'
    );
  });

  it('signs out: revokes the session, forgets the token and goes to the login page', async () => {
    window.localStorage.setItem(SESSION_TOKEN_KEY, 'tok');
    signOut.mockResolvedValue({ data: { success: true }, error: null });
    const user = userEvent.setup();
    render(<AppHeader />);

    await user.click(screen.getByRole('button', { name: /Menu du compte/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Se déconnecter/ }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(SESSION_TOKEN_KEY)).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith('/connexion');
  });

  it('still signs out locally when the API call fails', async () => {
    window.localStorage.setItem(SESSION_TOKEN_KEY, 'tok');
    signOut.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<AppHeader />);

    await user.click(screen.getByRole('button', { name: /Menu du compte/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Se déconnecter/ }));

    expect(window.localStorage.getItem(SESSION_TOKEN_KEY)).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith('/connexion');
  });
});

describe('PageShell', () => {
  it('renders the header, the title, the description, the actions and the content', () => {
    render(
      <PageShell
        title="Historique"
        description="Vos passages."
        actions={<button type="button">Exporter</button>}
      >
        <p>contenu</p>
      </PageShell>
    );
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Historique' })).toBeInTheDocument();
    expect(screen.getByText('Vos passages.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenu');
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });

  it('omits the description and the actions when not given', () => {
    render(<PageShell title="Sujets">x</PageShell>);
    expect(screen.queryByRole('button', { name: 'Exporter' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).nextElementSibling).toBeNull();
  });
});
