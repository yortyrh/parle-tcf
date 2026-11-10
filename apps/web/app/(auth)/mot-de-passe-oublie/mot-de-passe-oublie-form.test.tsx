import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { authClient } from '@/lib/auth-client';
import { MotDePasseOublieForm } from './mot-de-passe-oublie-form';

vi.mock('@/lib/auth-client', () => ({ authClient: { requestPasswordReset: vi.fn() } }));

const requestReset = vi.mocked(authClient.requestPasswordReset);
type ResetResult = Awaited<ReturnType<typeof authClient.requestPasswordReset>>;

beforeEach(() => {
  requestReset.mockReset();
});

async function submit() {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Adresse e-mail'));
  await user.paste('ana@example.fr');
  await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));
}

describe('MotDePasseOublieForm', () => {
  it('requests a reset link that opens the reset page of this site', async () => {
    requestReset.mockResolvedValue({ data: { status: true }, error: null } as ResetResult);
    render(<MotDePasseOublieForm />);

    await submit();

    expect(requestReset).toHaveBeenCalledWith({
      email: 'ana@example.fr',
      redirectTo: `${window.location.origin}/reinitialiser`,
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      "Si un compte existe avec cette adresse, un e-mail vient d'être envoyé."
    );
    expect(screen.queryByRole('button', { name: 'Envoyer le lien' })).not.toBeInTheDocument();
  });

  it('keeps the form and explains a failure', async () => {
    requestReset.mockResolvedValue({
      data: null,
      error: { status: 500, message: 'x' },
    });
    render(<MotDePasseOublieForm />);

    await submit();

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Impossible d'envoyer l'e-mail pour l'instant. Réessayez plus tard."
    );
    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('disables the button while sending', async () => {
    requestReset.mockReturnValue(new Promise(() => undefined));
    render(<MotDePasseOublieForm />);
    await submit();
    expect(screen.getByRole('button', { name: 'Envoi…' })).toBeDisabled();
  });

  it('links back to the login page', () => {
    render(<MotDePasseOublieForm />);
    expect(screen.getByRole('link', { name: 'Retour à la connexion' })).toHaveAttribute(
      'href',
      '/connexion'
    );
  });
});
