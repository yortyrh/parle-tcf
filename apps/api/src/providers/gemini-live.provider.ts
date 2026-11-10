import { GoogleGenAI } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import {
  type MintClientSecretParams,
  ProviderError,
  type VerifyKeyResult,
  type VoiceProvider,
} from './voice-provider.js';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
const TOKEN_LIFETIME_MS = 30 * 60_000;
const NEW_SESSION_WINDOW_MS = 2 * 60_000;

/** Gemini rejects a bad key with 400 or 403 rather than 401. */
const isKeyRejection = (status: number) => status === 400 || status === 401 || status === 403;

@Injectable()
export class GeminiLiveProvider implements VoiceProvider {
  readonly id = 'gemini' as const;
  private readonly logger = new Logger(GeminiLiveProvider.name);

  /**
   * Mints a single-use ephemeral token (Live API, v1alpha). The browser's
   * session configuration (instructions, voice) is not locked into the token,
   * because the token is single-use and expires within minutes.
   */
  async mintClientSecret(apiKey: string, _params: MintClientSecretParams): Promise<string> {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: 'v1alpha' },
      });
      const now = Date.now();
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: new Date(now + TOKEN_LIFETIME_MS).toISOString(),
          newSessionExpireTime: new Date(now + NEW_SESSION_WINDOW_MS).toISOString(),
        },
      });
      if (!token.name) {
        throw new ProviderError('Gemini: jeton éphémère manquant', 502);
      }
      return token.name;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      const status =
        typeof (error as { status?: unknown }).status === 'number'
          ? (error as { status: number }).status
          : 502;
      // Log the status only: the error text can echo request details.
      this.logger.error(`Gemini auth token failed: ${status}`);
      throw new ProviderError(
        isKeyRejection(status) ? 'Clé API refusée par Gemini' : `Gemini auth_tokens: ${status}`,
        isKeyRejection(status) ? 401 : status
      );
    }
  }

  async verifyKey(apiKey: string): Promise<VerifyKeyResult> {
    try {
      const res = await fetch(`${GEMINI_API}/models?pageSize=1`, {
        headers: { 'x-goog-api-key': apiKey },
      });
      if (res.ok) return { ok: true };
      if (isKeyRejection(res.status)) {
        return { ok: false, message: 'Clé refusée par Gemini.' };
      }
      return { ok: false, message: `Gemini a répondu ${res.status}.` };
    } catch {
      return { ok: false, message: 'Gemini est injoignable.' };
    }
  }
}
