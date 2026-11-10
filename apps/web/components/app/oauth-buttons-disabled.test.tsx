import { afterAll, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { OAuthButtons } from './oauth-buttons';

// The enabled providers are read once, when the module loads.
vi.hoisted(() => {
  vi.stubEnv('NEXT_PUBLIC_AUTH_GITHUB_OAUTH_ENABLED', '');
  vi.stubEnv('NEXT_PUBLIC_AUTH_GOOGLE_OAUTH_ENABLED', 'false');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('OAuthButtons without a configured provider', () => {
  it('renders nothing', () => {
    const { container } = render(<OAuthButtons next="/tableau-de-bord" />);
    expect(container).toBeEmptyDOMElement();
  });
});
