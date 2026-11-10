import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SESSION_TOKEN_KEY } from '@/lib/session-token';
import { AccountLinks } from './account-links';
import { DemoLoop } from './demo-loop';

afterEach(() => {
  window.localStorage.clear();
});

describe('AccountLinks', () => {
  it('offers to sign in or create an account without a session', () => {
    render(<AccountLinks />);
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute(
      'href',
      '/connexion'
    );
    expect(screen.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute(
      'href',
      '/inscription'
    );
    expect(screen.queryByRole('link', { name: 'Ouvrir l’application' })).not.toBeInTheDocument();
  });

  it('goes straight to the app with a stored session', () => {
    window.localStorage.setItem(SESSION_TOKEN_KEY, 'tok');
    render(<AccountLinks />);
    expect(screen.getByRole('link', { name: 'Ouvrir l’application' })).toHaveAttribute(
      'href',
      '/tableau-de-bord'
    );
    expect(screen.queryByRole('link', { name: 'Se connecter' })).not.toBeInTheDocument();
  });
});

describe('DemoLoop', () => {
  it('describes the illustrated session for screen readers', () => {
    render(<DemoLoop />);
    expect(
      screen.getByRole('figure', {
        name: 'Exemple de session : l’examinateur pose une question, le candidat répond, puis la correction s’affiche.',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Tâche 3 · Point de vue')).toBeInTheDocument();
  });
});
