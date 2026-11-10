import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authClient } from '@/lib/auth-client';
import { ReinitialiserForm } from './reinitialiser-form';

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => nav.params,
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { resetPassword: vi.fn() } }));

const resetPassword = vi.mocked(authClient.resetPassword);
type ResetResult = Awaited<ReturnType<typeof authClient.resetPassword>>;

beforeEach(() => {
  nav.params = new URLSearchParams({ token: 'reset-token' });
  nav.replace.mockReset();
  resetPassword.mockReset();
});

async function submit() {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Nouveau mot de passe (8 caractères minimum)'));
  await user.paste('nouveau-mdp');
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
}

describe('ReinitialiserForm', () => {
  it('sets the new password with the token of the link, then opens the login page', async () => {
    resetPassword.mockResolvedValue({ data: { status: true }, error: null } as ResetResult);
    render(<ReinitialiserForm />);

    await submit();

    expect(resetPassword).toHaveBeenCalledWith({
      newPassword: 'nouveau-mdp',
      token: 'reset-token',
    });
    expect(nav.replace).toHaveBeenCalledWith('/connexion');
  });

  it('reports an invalid or expired link', async () => {
    resetPassword.mockResolvedValue({
      data: null,
      error: { status: 400, message: 'INVALID_TOKEN' },
    });
    render(<ReinitialiserForm />);

    await submit();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ce lien est invalide ou a expiré. Demandez-en un nouveau.'
    );
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
  });

  it('disables the button while saving', async () => {
    resetPassword.mockReturnValue(new Promise(() => undefined));
    render(<ReinitialiserForm />);
    await submit();
    expect(screen.getByRole('button', { name: 'Enregistrement…' })).toBeDisabled();
  });

  it('explains an incomplete link and offers a new one', () => {
    nav.params = new URLSearchParams();
    render(<ReinitialiserForm />);
    expect(screen.getByRole('heading', { name: 'Lien invalide' })).toBeInTheDocument();
    expect(screen.getByText('Ce lien de réinitialisation est incomplet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute(
      'href',
      '/mot-de-passe-oublie'
    );
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument();
  });
});
