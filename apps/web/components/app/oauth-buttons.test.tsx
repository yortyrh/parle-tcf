import { afterAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OAuthButtons } from './oauth-buttons';

// The enabled providers are read once, when the module loads.
vi.hoisted(() => {
  vi.stubEnv('NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_EXAM_API_URL', 'https://api.example.test');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('OAuthButtons', () => {
  it('offers every enabled provider, then the classic form', () => {
    render(<OAuthButtons next="/sujets" />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Continuer avec GitHub',
      'Continuer avec Google',
    ]);
    expect(screen.getByText('ou')).toBeInTheDocument();
  });

  it.each([
    ['Continuer avec Google', 'google'],
    ['Continuer avec GitHub', 'github'],
  ])('"%s" starts the %s sign-in on the API with the return path', async (name, provider) => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, assign },
    });
    try {
      render(<OAuthButtons next="/sujets" />);
      await userEvent.click(screen.getByRole('button', { name }));
      expect(assign).toHaveBeenCalledWith(
        `https://api.example.test/auth/oauth/${provider}?redirect=%2Fsujets`
      );
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});
