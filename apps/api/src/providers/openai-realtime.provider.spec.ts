import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { OpenAiRealtimeProvider } from './openai-realtime.provider.js';
import { ProviderError } from './voice-provider.js';

const KEY = 'sk-test-0123456789abcdef';
const PARAMS = { model: 'gpt-realtime-mini', voice: 'alloy' };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('OpenAiRealtimeProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let logged: string[];
  let provider: OpenAiRealtimeProvider;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    logged = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
    provider = new OpenAiRealtimeProvider();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is the openai provider', () => {
    expect(provider.id).toBe('openai');
  });

  describe('mintClientSecret', () => {
    it('posts the session config with the user key and returns the top-level value', async () => {
      fetchMock.mockResolvedValue(json(200, { value: 'ek_top', expires_at: 1 }));

      await expect(provider.mintClientSecret(KEY, PARAMS)).resolves.toBe('ek_top');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.openai.com/v1/realtime/client_secrets');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(String(init.body))).toEqual({
        session: {
          type: 'realtime',
          model: 'gpt-realtime-mini',
          audio: { output: { voice: 'alloy' } },
        },
      });
    });

    it('falls back to the nested client_secret.value', async () => {
      fetchMock.mockResolvedValue(json(200, { client_secret: { value: 'ek_nested' } }));
      await expect(provider.mintClientSecret(KEY, PARAMS)).resolves.toBe('ek_nested');
    });

    it('prefers the top-level value over the nested one', async () => {
      fetchMock.mockResolvedValue(
        json(200, { value: 'ek_top', client_secret: { value: 'ek_nested' } })
      );
      await expect(provider.mintClientSecret(KEY, PARAMS)).resolves.toBe('ek_top');
    });

    it('uses the nested value when the top-level one is empty', async () => {
      fetchMock.mockResolvedValue(json(200, { value: '', client_secret: { value: 'ek_nested' } }));
      await expect(provider.mintClientSecret(KEY, PARAMS)).resolves.toBe('ek_nested');
    });

    it.each([
      ['an empty body', {}],
      ['empty values', { value: '', client_secret: { value: '' } }],
      ['non-string values', { value: 42, client_secret: { value: 7 } }],
      ['a client_secret without value', { client_secret: {} }],
    ])('fails with 502 on %s', async (_label, body) => {
      fetchMock.mockResolvedValue(json(200, body));
      const error = await provider.mintClientSecret(KEY, PARAMS).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({
        status: 502,
        message: 'OpenAI client_secrets: missing ephemeral value',
      });
    });

    it('fails with 502 when the success body is not JSON', async () => {
      fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
      await expect(provider.mintClientSecret(KEY, PARAMS)).rejects.toMatchObject({ status: 502 });
    });

    it('reports a rejected key on 401', async () => {
      fetchMock.mockResolvedValue(json(401, { error: { message: `bad key ${KEY}` } }));
      const error = await provider.mintClientSecret(KEY, PARAMS).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ status: 401, message: 'Clé API refusée par OpenAI' });
    });

    it.each([400, 403, 429, 500, 503])('passes upstream status %i through', async (status) => {
      fetchMock.mockResolvedValue(json(status, { error: { message: 'nope' } }));
      await expect(provider.mintClientSecret(KEY, PARAMS)).rejects.toMatchObject({
        status,
        message: `OpenAI client_secrets: ${status}`,
      });
    });

    it('handles an error body that is not JSON', async () => {
      fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }));
      await expect(provider.mintClientSecret(KEY, PARAMS)).rejects.toMatchObject({
        status: 502,
        message: 'OpenAI client_secrets: 502',
      });
    });

    it('logs the status only, never the key or the upstream body', async () => {
      fetchMock.mockResolvedValue(json(401, { error: { message: `bad key ${KEY}` } }));
      await provider.mintClientSecret(KEY, PARAMS).catch(() => undefined);
      expect(logged).toEqual(['OpenAI client_secrets failed: 401']);
      expect(logged.join('\n')).not.toContain(KEY);
    });

    it('never puts the key in the error message', async () => {
      fetchMock.mockResolvedValue(json(500, { error: { message: KEY } }));
      const error = (await provider
        .mintClientSecret(KEY, PARAMS)
        .catch((e: unknown) => e)) as Error;
      expect(error.message).not.toContain(KEY);
    });
  });

  describe('verifyKey', () => {
    it('lists the models with the key', async () => {
      fetchMock.mockResolvedValue(json(200, { data: [] }));
      await expect(provider.verifyKey(KEY)).resolves.toEqual({ ok: true });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.openai.com/v1/models');
      expect(init.headers).toEqual({ Authorization: `Bearer ${KEY}` });
    });

    it('reports a rejected key on 401', async () => {
      fetchMock.mockResolvedValue(json(401, {}));
      await expect(provider.verifyKey(KEY)).resolves.toEqual({
        ok: false,
        message: 'Clé refusée par OpenAI (401).',
      });
    });

    it.each([403, 429, 500])('reports other statuses (%i)', async (status) => {
      fetchMock.mockResolvedValue(json(status, {}));
      await expect(provider.verifyKey(KEY)).resolves.toEqual({
        ok: false,
        message: `OpenAI a répondu ${status}.`,
      });
    });

    it('reports a network failure', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      await expect(provider.verifyKey(KEY)).resolves.toEqual({
        ok: false,
        message: 'OpenAI est injoignable.',
      });
    });
  });
});
