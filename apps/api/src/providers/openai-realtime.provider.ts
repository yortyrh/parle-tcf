import { Injectable, Logger } from '@nestjs/common';
import {
  type MintClientSecretParams,
  ProviderError,
  type VerifyKeyResult,
  type VoiceProvider,
} from './voice-provider.js';

const OPENAI_API = 'https://api.openai.com/v1';

@Injectable()
export class OpenAiRealtimeProvider implements VoiceProvider {
  readonly id = 'openai' as const;
  private readonly logger = new Logger(OpenAiRealtimeProvider.name);

  async mintClientSecret(
    apiKey: string,
    { model, voice }: MintClientSecretParams
  ): Promise<string> {
    const res = await fetch(`${OPENAI_API}/realtime/client_secrets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model,
          audio: { output: { voice } },
        },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      // Log status only: the body can echo request details.
      this.logger.error(`OpenAI client_secrets failed: ${res.status}`);
      throw new ProviderError(
        res.status === 401 ? 'Clé API refusée par OpenAI' : `OpenAI client_secrets: ${res.status}`,
        res.status
      );
    }

    const nested = (data as { client_secret?: { value?: unknown } }).client_secret?.value;
    const secret =
      typeof data.value === 'string' && data.value
        ? data.value
        : typeof nested === 'string' && nested
          ? nested
          : null;
    if (!secret) {
      this.logger.error('Unexpected client_secrets response shape');
      throw new ProviderError('OpenAI client_secrets: missing ephemeral value', 502);
    }
    return secret;
  }

  async verifyKey(apiKey: string): Promise<VerifyKeyResult> {
    try {
      const res = await fetch(`${OPENAI_API}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) return { ok: true };
      if (res.status === 401) {
        return { ok: false, message: 'Clé refusée par OpenAI (401).' };
      }
      return { ok: false, message: `OpenAI a répondu ${res.status}.` };
    } catch {
      return { ok: false, message: 'OpenAI est injoignable.' };
    }
  }
}
