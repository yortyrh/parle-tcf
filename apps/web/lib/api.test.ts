import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ROUTES } from '@parle-tcf/shared';
import { ApiError, api, getApiBase } from './api';
import { SESSION_TOKEN_KEY } from './session-token';

const ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fakeStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_EXAM_API_URL', 'https://api.example.test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function lastRequest(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
}

describe('getApiBase', () => {
  it('uses NEXT_PUBLIC_EXAM_API_URL without a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_EXAM_API_URL', 'https://api.example.test/');
    expect(getApiBase()).toBe('https://api.example.test');
  });

  it('falls back to the local API when the variable is empty', () => {
    vi.stubEnv('NEXT_PUBLIC_EXAM_API_URL', '');
    expect(getApiBase()).toBe('http://localhost:3001');
  });
});

describe('api calls', () => {
  it('POSTs the JSON input to the route, without cookies, and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await expect(api.deleteAttempt(ATTEMPT_ID)).resolves.toEqual({ ok: true });

    const { url, init } = lastRequest();
    expect(url).toBe(`https://api.example.test${API_ROUTES.attemptsDelete}`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ attemptId: ATTEMPT_ID });
    expect(init.keepalive).toBeUndefined();
  });

  it('sends the stored session token as a bearer header', async () => {
    vi.stubGlobal('window', { localStorage: fakeStorage({ [SESSION_TOKEN_KEY]: 'tok-123' }) });
    fetchMock.mockResolvedValue(jsonResponse({ provider: 'openai' }));

    await api.getSettings();

    expect(lastRequest().init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok-123',
    });
  });

  it('forwards keepalive for checkpoints and completions sent while the page unloads', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse({ ok: true, limitReached: false }))
    );

    await api.checkpointAttempt({ attemptId: ATTEMPT_ID, lines: [] }, { keepalive: true });
    expect(lastRequest().init.keepalive).toBe(true);

    await api.completeAttempt({ attemptId: ATTEMPT_ID, lines: [] }, { keepalive: true });
    expect(lastRequest().init.keepalive).toBe(true);
    expect(lastRequest().url).toBe(`https://api.example.test${API_ROUTES.attemptsComplete}`);
  });

  it('turns an error body into an ApiError with its code, status and message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: 'PROVIDER_NOT_CONFIGURED', message: 'Clé manquante' }, { status: 400 })
    );

    const error = await api.createExamSession({ taskType: 'tache1' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: 'ApiError',
      code: 'PROVIDER_NOT_CONFIGURED',
      status: 400,
      message: 'Clé manquante',
    });
  });

  describe('input validation errors', () => {
    function validationError(data: unknown, message = 'Input validation failed') {
      fetchMock.mockResolvedValue(
        jsonResponse({ code: 'BAD_REQUEST', message, data }, { status: 400 })
      );
      return api.saveSettings({ provider: 'openai', apiKey: 'sk-court' });
    }

    it('uses the message of the first issue', async () => {
      await expect(
        validationError({
          issues: [
            { message: 'Clé API trop courte', path: ['apiKey'] },
            { message: 'Une clé OpenAI commence par « sk- »', path: ['apiKey'] },
          ],
        })
      ).rejects.toMatchObject({
        name: 'ApiError',
        code: 'BAD_REQUEST',
        status: 400,
        message: 'Clé API trop courte',
      });
    });

    it.each([
      ['empty', { issues: [] }],
      ['not an array', { issues: 'invalide' }],
      ['without a message', { issues: [{ path: ['apiKey'] }] }],
      ['with a non-string message', { issues: [{ message: 42, path: [] }] }],
      ['null entries', { issues: [null] }],
    ])('falls back to "Requête invalide." when the issues are %s', async (_label, data) => {
      await expect(validationError(data)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        status: 400,
        message: 'Requête invalide.',
      });
    });

    it('keeps any other message when the issues are unusable', async () => {
      await expect(
        validationError({ issues: [] }, 'Clé refusée par le fournisseur')
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        status: 400,
        message: 'Clé refusée par le fournisseur',
      });
      await expect(
        validationError({ issues: [] }, 'input validation failed')
      ).rejects.toMatchObject({
        message: 'input validation failed',
      });
    });
  });

  it('maps a 401 without a body to UNAUTHORIZED', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 401 }));

    await expect(api.getUsage()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      status: 401,
      message: 'Erreur 401',
    });
  });

  it('maps any other failure without a body to ERROR with the status in the message', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));

    await expect(api.getUsage()).rejects.toMatchObject({
      code: 'ERROR',
      status: 500,
      message: 'Erreur 500',
    });
  });

  it('reports an unreachable server as a NETWORK error in French', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.getUsage()).rejects.toMatchObject({
      code: 'NETWORK',
      status: 0,
      message: 'Impossible de joindre le serveur. Vérifiez votre connexion.',
    });
  });

  it.each([
    [
      'createExamSession',
      () => api.createExamSession({ taskType: 'tache2' }),
      'sessionCreate',
      { taskType: 'tache2' },
    ],
    [
      'refreshSessionToken',
      () => api.refreshSessionToken(ATTEMPT_ID),
      'sessionToken',
      { attemptId: ATTEMPT_ID },
    ],
    ['getSettings', () => api.getSettings(), 'settingsGet', {}],
    [
      'saveSettings',
      () => api.saveSettings({ provider: 'openai', apiKey: 'sk-x' }),
      'settingsUpsert',
      { provider: 'openai', apiKey: 'sk-x' },
    ],
    ['deleteSettings', () => api.deleteSettings(), 'settingsDelete', {}],
    ['testSettings', () => api.testSettings(), 'settingsTest', {}],
    ['listAttempts', () => api.listAttempts(), 'attemptsList', {}],
    ['listAttempts with filters', () => api.listAttempts({ task: 2 }), 'attemptsList', { task: 2 }],
    ['getAttempt', () => api.getAttempt(ATTEMPT_ID), 'attemptsGet', { attemptId: ATTEMPT_ID }],
    [
      'reevaluateAttempt',
      () => api.reevaluateAttempt(ATTEMPT_ID),
      'attemptsReevaluate',
      { attemptId: ATTEMPT_ID },
    ],
    ['getRun', () => api.getRun('run-1'), 'runsGet', { runId: 'run-1' }],
    ['getAudioStatus', () => api.getAudioStatus(), 'audioStatus', {}],
    ['setAudioConsent', () => api.setAudioConsent(true), 'audioSetConsent', { consent: true }],
    [
      'getAudioUploadUrl',
      () => api.getAudioUploadUrl({ attemptId: ATTEMPT_ID, contentType: 'audio/webm' }),
      'audioUploadUrl',
      { attemptId: ATTEMPT_ID, contentType: 'audio/webm' },
    ],
    [
      'confirmAudioUpload',
      () => api.confirmAudioUpload(ATTEMPT_ID),
      'audioConfirm',
      { attemptId: ATTEMPT_ID },
    ],
    [
      'getAudioDownloadUrl',
      () => api.getAudioDownloadUrl(ATTEMPT_ID),
      'audioDownloadUrl',
      { attemptId: ATTEMPT_ID },
    ],
    ['getUsage', () => api.getUsage(), 'usageGet', {}],
    ['listExercises', () => api.listExercises({ task: 3 }), 'exercisesList', { task: 3 }],
    ['listExerciseSessions', () => api.listExerciseSessions(), 'exercisesSessions', {}],
  ] as const)('%s posts to its route', async (_name, invoke, route, body) => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await invoke();

    const { url, init } = lastRequest();
    expect(url).toBe(`https://api.example.test${API_ROUTES[route]}`);
    expect(JSON.parse(init.body as string)).toEqual(body);
  });
});
