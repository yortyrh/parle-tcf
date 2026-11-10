import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authClient } from '@/lib/auth-client';
import { InscriptionForm } from './inscription-form';

const nav = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, refresh: nav.refresh, push: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { signUp: { email: vi.fn() } } }));

const signUp = vi.mocked(authClient.signUp.email);
type SignUpResult = Awaited<ReturnType<typeof authClient.signUp.email>>;
const result = (value: unknown) => value as SignUpResult;

beforeEach(() => {
  nav.replace.mockReset();
  nav.refresh.mockReset();
  signUp.mockReset();
});

async function submit() {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Prénom'));
  await user.paste('Ana');
  await user.click(screen.getByLabelText('Adresse e-mail'));
  await user.paste('ana+tcf@example.fr');
  await user.click(screen.getByLabelText('Mot de passe (8 caractères minimum)'));
  await user.paste('motdepasse');
  await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));
}

describe('InscriptionForm', () => {
  it('creates the account and asks to verify the email', async () => {
    signUp.mockResolvedValue(result({ data: { token: null, user: {} }, error: null }));
    render(<InscriptionForm />);

    await submit();

    expect(signUp).toHaveBeenCalledWith({
      name: 'Ana',
      email: 'ana+tcf@example.fr',
      password: 'motdepasse',
    });
    expect(nav.replace).toHaveBeenCalledWith('/verifier-email?email=ana%2Btcf%40example.fr');
    expect(nav.refresh).not.toHaveBeenCalled();
  });

  it('opens the settings when the account is signed in right away', async () => {
    signUp.mockResolvedValue(result({ data: { token: 'tok', user: {} }, error: null }));
    render(<InscriptionForm />);
    await submit();
    expect(nav.replace).toHaveBeenCalledWith('/parametres?bienvenue=1');
    expect(nav.refresh).toHaveBeenCalled();
  });

  it('reports an existing account (422)', async () => {
    signUp.mockResolvedValue(result({ data: null, error: { status: 422, message: 'exists' } }));
    render(<InscriptionForm />);
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Un compte existe déjà avec cette adresse e-mail.'
    );
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('shows the message of other errors', async () => {
    signUp.mockResolvedValue(
      result({ data: null, error: { status: 400, message: 'Mot de passe trop faible' } })
    );
    render(<InscriptionForm />);
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent('Mot de passe trop faible');
  });

  it('falls back to a generic message', async () => {
    signUp.mockResolvedValue(result({ data: null, error: { status: 500 } }));
    render(<InscriptionForm />);
    await submit();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Impossible de créer le compte pour l'instant."
    );
    expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeEnabled();
  });

  it('disables the button while creating the account', async () => {
    signUp.mockReturnValue(new Promise(() => undefined));
    render(<InscriptionForm />);
    await submit();
    expect(screen.getByRole('button', { name: 'Création…' })).toBeDisabled();
  });

  it('links to the login page', () => {
    render(<InscriptionForm />);
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion'
    );
  });
});
