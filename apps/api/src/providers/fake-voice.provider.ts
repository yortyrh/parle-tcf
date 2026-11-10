import type {
  MintClientSecretParams,
  ProviderId,
  VerifyKeyResult,
  VoiceProvider,
} from './voice-provider.js';

/** Secret handed to the browser in fake mode; the web fake session accepts it. */
export const FAKE_CLIENT_SECRET = 'fake-client-secret';

/**
 * Stand-in backend for `VOICE_PROVIDER=fake` (integration and end-to-end
 * tests): no network call, any key "works" except one containing "invalid".
 */
export class FakeVoiceProvider implements VoiceProvider {
  constructor(readonly id: ProviderId) {}

  mintClientSecret(apiKey: string, _params: MintClientSecretParams): Promise<string> {
    return Promise.resolve(`${FAKE_CLIENT_SECRET}:${this.id}:${apiKey.length}`);
  }

  verifyKey(apiKey: string): Promise<VerifyKeyResult> {
    return Promise.resolve(
      apiKey.includes('invalid')
        ? { ok: false, message: 'Clé API refusée (mode test)' }
        : { ok: true }
    );
  }
}
