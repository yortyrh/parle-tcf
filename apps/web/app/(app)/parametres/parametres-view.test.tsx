import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderSettings } from '@parle-tcf/shared';
import { upsertProviderSettingsInputSchema } from '@parle-tcf/shared';
import { render, screen } from '@testing-library/react';
import { api } from '@/lib/api';
import { ParametresView } from './parametres-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { signOut: vi.fn(), deleteUser: vi.fn() },
}));
vi.mock('@/lib/api', () => ({
  api: { getSettings: vi.fn(), getAudioStatus: vi.fn() },
}));

const getSettings = vi.mocked(api.getSettings);

function settings(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    configured: false,
    provider: 'openai',
    last4: null,
    realtimeModel: null,
    voice: null,
    textModel: null,
    verifiedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  getSettings.mockReset();
  vi.mocked(api.getAudioStatus).mockResolvedValue({ available: false, consent: false });
});

describe('ParametresView API key field', () => {
  it('requires at least 20 characters for a new key, like the shared schema', async () => {
    getSettings.mockResolvedValue(settings());
    render(<ParametresView />);

    const input = await screen.findByLabelText('Clé API');
    expect(input).toHaveAttribute('minlength', '20');
    expect(input).toBeRequired();
  });

  it('keeps the 20-character minimum when replacing a stored key', async () => {
    getSettings.mockResolvedValue(settings({ configured: true, last4: 'abcd' }));
    render(<ParametresView />);

    const input = await screen.findByLabelText('Remplacer la clé (optionnel)');
    expect(input).toHaveAttribute('minlength', '20');
    expect(input).not.toBeRequired();
  });

  it('uses the shortest key length the shared schema accepts', async () => {
    getSettings.mockResolvedValue(settings());
    render(<ParametresView />);
    const input = await screen.findByLabelText('Clé API');

    const accepts = (length: number) =>
      upsertProviderSettingsInputSchema.safeParse({
        provider: 'openai',
        apiKey: `sk-${'x'.repeat(length - 3)}`,
      }).success;
    let shortest = 3;
    while (!accepts(shortest)) shortest += 1;

    expect(input).toHaveAttribute('minlength', String(shortest));
  });
});
