import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthShell, FieldLabel, FormError } from './auth-shell';
import { DevMailpitBanner } from './dev-mailpit-banner';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AuthShell', () => {
  it('renders the title, description, content, footer and privacy link', () => {
    render(
      <AuthShell title="Connexion" description="Bienvenue." footer={<span>Pied</span>}>
        <p>formulaire</p>
      </AuthShell>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Connexion' })).toBeInTheDocument();
    expect(screen.getByText('Bienvenue.')).toBeInTheDocument();
    expect(screen.getByText('formulaire')).toBeInTheDocument();
    expect(screen.getByText('Pied')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute(
      'href',
      '/confidentialite'
    );
    expect(screen.getByRole('img', { name: 'parle-tcf' }).closest('a')).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('omits the description and the footer when not given', () => {
    const { container } = render(<AuthShell title="Lien invalide">x</AuthShell>);
    // Only the privacy line remains.
    expect([...container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Confidentialité',
    ]);
  });
});

describe('FieldLabel and FormError', () => {
  it('labels its field', () => {
    render(
      <>
        <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
        <input id="email" />
      </>
    );
    expect(screen.getByLabelText('Adresse e-mail')).toBeInTheDocument();
  });

  it('announces an error and renders nothing without one', () => {
    const { rerender } = render(<FormError message="E-mail ou mot de passe incorrect." />);
    expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou mot de passe incorrect.');
    rerender(<FormError message={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('DevMailpitBanner', () => {
  it('points to Mailpit in local development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(<DevMailpitBanner />);
    expect(screen.getByRole('link', { name: 'Mailpit' })).toHaveAttribute(
      'href',
      'http://localhost:8025'
    );
  });

  it('stays hidden outside development', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { container } = render(<DevMailpitBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
