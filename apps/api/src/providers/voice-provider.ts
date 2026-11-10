export type ProviderId = 'openai' | 'gemini';

export interface MintClientSecretParams {
  model: string;
  voice: string;
}

export interface VerifyKeyResult {
  ok: boolean;
  message?: string;
}

/**
 * A realtime voice backend. The API holds the user's long-lived key and only
 * ever hands the browser a short-lived client secret.
 */
export interface VoiceProvider {
  readonly id: ProviderId;
  mintClientSecret(apiKey: string, params: MintClientSecretParams): Promise<string>;
  /** Cheap authenticated call proving the key works. */
  verifyKey(apiKey: string): Promise<VerifyKeyResult>;
}

export const VOICE_PROVIDERS = Symbol('VOICE_PROVIDERS');

/** Looks a backend up by the provider chosen in the user's settings. */
export class VoiceProviderRegistry {
  constructor(private readonly providers: VoiceProvider[]) {}

  get(id: ProviderId): VoiceProvider {
    const found = this.providers.find((p) => p.id === id);
    if (!found) throw new Error(`No voice provider registered for "${id}"`);
    return found;
  }
}

/** Raised when the upstream provider rejects a call. Never carries the key. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
