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
  readonly id: "openai";
  mintClientSecret(
    apiKey: string,
    params: MintClientSecretParams,
  ): Promise<string>;
  /** Cheap authenticated call proving the key works. */
  verifyKey(apiKey: string): Promise<VerifyKeyResult>;
}

export const VOICE_PROVIDER = Symbol("VOICE_PROVIDER");

/** Raised when the upstream provider rejects a call. Never carries the key. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
