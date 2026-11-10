import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { GeminiLiveProvider } from './gemini-live.provider.js';
import { ProviderError } from './voice-provider.js';

const genai = vi.hoisted(() => ({
  constructed: [] as unknown[],
  create: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    authTokens = { create: genai.create };
    constructor(options: unknown) {
      genai.constructed.push(options);
    }
  },
}));

const KEY = 'AIzaTest0123456789abcdef';
const PARAMS = { model: 'gemini-live', voice: 'Puck' };
const NOW = new Date('2026-03-10T10:00:00.000Z');

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status} ${KEY}`), { status });

describe('GeminiLiveProvider', () => {
  let logged: string[];
  let provider: GeminiLiveProvider;

  beforeEach(() => {
    genai.constructed.length = 0;
    genai.create.mockReset();
    logged = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
    provider = new GeminiLiveProvider();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is the gemini provider', () => {
    expect(provider.id).toBe('gemini');
  });

  describe('mintClientSecret', () => {
    it('mints a single-use v1alpha token valid 30 min, opening a session within 2 min', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      genai.create.mockResolvedValue({ name: 'auth_tokens/abc' });

      await expect(provider.mintClientSecret(KEY, PARAMS)).resolves.toBe('auth_tokens/abc');

      expect(genai.constructed).toEqual([{ apiKey: KEY, httpOptions: { apiVersion: 'v1alpha' } }]);
      expect(genai.create).toHaveBeenCalledWith({
        config: {
          uses: 1,
          expireTime: '2026-03-10T10:30:00.000Z',
          newSessionExpireTime: '2026-03-10T10:02:00.000Z',
        },
      });
    });

    it.each([
      ['no name', {}],
      ['an empty name', { name: '' }],
    ])('fails with 502 when the token has %s', async (_label, token) => {
      genai.create.mockResolvedValue(token);
      const error = await provider.mintClientSecret(KEY, PARAMS).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ status: 502, message: 'Gemini: jeton éphémère manquant' });
      expect(logged).toEqual([]);
    });

    it.each([400, 401, 403])('maps upstream %i to a rejected key (401)', async (status) => {
      genai.create.mockRejectedValue(httpError(status));
      const error = await provider.mintClientSecret(KEY, PARAMS).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ProviderError);
      expect(error).toMatchObject({ status: 401, message: 'Clé API refusée par Gemini' });
    });

    it.each([404, 429, 500, 503])('passes upstream status %i through', async (status) => {
      genai.create.mockRejectedValue(httpError(status));
      await expect(provider.mintClientSecret(KEY, PARAMS)).rejects.toMatchObject({
        status,
        message: `Gemini auth_tokens: ${status}`,
      });
    });

    it.each([
      ['a plain error', new Error('socket hang up')],
      ['a non-numeric status', Object.assign(new Error('x'), { status: '403' })],
      ['a thrown string', 'boom'],
    ])('treats %s as a 502', async (_label, thrown) => {
      genai.create.mockRejectedValue(thrown);
      await expect(provider.mintClientSecret(KEY, PARAMS)).rejects.toMatchObject({
        status: 502,
        message: 'Gemini auth_tokens: 502',
      });
    });

    it('fails when the client cannot even be built', async () => {
      genai.create.mockImplementation(() => {
        throw httpError(401);
      });
      await expect(provider.mintClientSecret(KEY, PARAMS)).rejects.toMatchObject({ status: 401 });
    });

    it('logs the status only, never the key or the error text', async () => {
      genai.create.mockRejectedValue(httpError(403));
      await provider.mintClientSecret(KEY, PARAMS).catch(() => undefined);
      expect(logged).toEqual(['Gemini auth token failed: 403']);
      expect(logged.join('\n')).not.toContain(KEY);
    });
  });

  describe('verifyKey', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
    });

    it('lists one model with the key in a header, not in the URL', async () => {
      fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
      await expect(provider.verifyKey(KEY)).resolves.toEqual({ ok: true });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1');
      expect(url).not.toContain(KEY);
      expect(init.headers).toEqual({ 'x-goog-api-key': KEY });
    });

    it.each([400, 401, 403])('reports a rejected key on %i', async (status) => {
      fetchMock.mockResolvedValue(new Response('{}', { status }));
      await expect(provider.verifyKey(KEY)).resolves.toEqual({
        ok: false,
        message: 'Clé refusée par Gemini.',
      });
    });

    it.each([404, 429, 500])('reports other statuses (%i)', async (status) => {
      fetchMock.mockResolvedValue(new Response('{}', { status }));
      await expect(provider.verifyKey(KEY)).resolves.toEqual({
        ok: false,
        message: `Gemini a répondu ${status}.`,
      });
    });

    it('reports a network failure', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      await expect(provider.verifyKey(KEY)).resolves.toEqual({
        ok: false,
        message: 'Gemini est injoignable.',
      });
    });
  });
});
