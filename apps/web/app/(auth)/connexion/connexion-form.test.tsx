import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authClient } from '@/lib/auth-client';
import { ConnexionForm } from './connexion-form';

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: nav.refresh, push: vi.fn() }),
  useSearchParams: () => nav.params,
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { email: vi.fn() } } }));

const signIn = vi.mocked(authClient.signIn.email);

type SignInResult = Awaited<ReturnType<typeof authClient.signIn.email>>;
const ok = { data: { token: 't' }, error: null } as unknown as SignInResult;
const failure = (status: number) =>
  ({ data: null, error: { status, message: 'x' } }) as unknown as SignInResult;

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
  nav.refresh.mockReset();
  signIn.mockReset();
});

async function submit(email = 'ana@example.fr', password = 'motdepasse') {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Adresse e-mail'));
  await user.paste(email);
  await user.click(screen.getByLabelText('Mot de passe'));
  await user.paste(password);
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('ConnexionForm', () => {
  it('signs in with the email and password, then opens the requested page', async () => {
    nav.params = new URLSearchParams({ next: '/sujets' });
    signIn.mockResolvedValue(ok);
    render(<ConnexionForm />);

    await submit();

    expect(signIn).toHaveBeenCalledWith({ email: 'ana@example.fr', password: 'motdepasse' });
    expect(nav.replace).toHaveBeenCalledWith('/sujets');
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('opens the dashboard by default', async () => {
    signIn.mockResolvedValue(ok);
    render(<ConnexionForm />);
    await submit();
    expect(nav.replace).toHaveBeenCalledWith('/tableau-de-bord');
  });

  it('never redirects to another site', async () => {
    nav.params = new URLSearchParams({ next: '//evil.example' });
    signIn.mockResolvedValue(ok);
    render(<ConnexionForm />);
    await submit();
    expect(nav.replace).toHaveBeenCalledWith('/tableau-de-bord');
  });

  it('asks to confirm the email when the account is not verified (403)', async () => {
    signIn.mockResolvedValue(failure(403));
    render(<ConnexionForm />);
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Confirmez votre adresse e-mail avant de vous connecter (vérifiez votre boîte de réception).'
    );
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('reports wrong credentials otherwise', async () => {
    signIn.mockResolvedValue(failure(401));
    render(<ConnexionForm />);
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect.');
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });

  it('disables the button while signing in', async () => {
    let resolve!: (r: SignInResult) => void;
    signIn.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<ConnexionForm />);
    await submit();
    expect(screen.getByRole('button', { name: 'Connexion…' })).toBeDisabled();
    resolve(failure(401));
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });

  it('explains a failed social sign-in', () => {
    nav.params = new URLSearchParams({ erreur: 'oauth' });
    render(<ConnexionForm />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La connexion avec ce fournisseur a échoué. Réessayez.'
    );
  });

  it('links to sign-up and password recovery', () => {
    render(<ConnexionForm />);
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute(
      'href',
      '/inscription'
    );
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie'
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
