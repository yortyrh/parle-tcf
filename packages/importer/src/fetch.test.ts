import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_AGENT, fetchPage } from './fetch';

const URL_A = 'https://reussir-tcfcanada.com/decembre-2025-expression-orale/';

type Call = { url: string; init: RequestInit | undefined };

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return respond();
  });
  return { calls, fetchImpl: impl as unknown as typeof fetch };
}

const headersOf = (call: Call) => new Headers(call.init?.headers);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DEFAULT_USER_AGENT', () => {
  it('identifies the importer', () => {
    expect(DEFAULT_USER_AGENT.startsWith('parle-tcf-importer/')).toBe(true);
    expect(DEFAULT_USER_AGENT.length).toBeGreaterThan('parle-tcf-importer/'.length);
  });
});

describe('fetchPage', () => {
  it('returns the HTML of a 200 response', async () => {
    const { calls, fetchImpl } = fakeFetch(
      () => new Response('<html><body>ok</body></html>', { status: 200 })
    );
    expect(await fetchPage(URL_A, { fetchImpl })).toEqual({
      kind: 'ok',
      html: '<html><body>ok</body></html>',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(URL_A);
  });

  it('sends the default User-Agent and an HTML Accept header', async () => {
    const { calls, fetchImpl } = fakeFetch(() => new Response('x', { status: 200 }));
    await fetchPage(URL_A, { fetchImpl });
    const headers = headersOf(calls[0]);
    expect(headers.get('user-agent')).toBe(DEFAULT_USER_AGENT);
    expect(headers.get('accept')).toBe('text/html');
  });

  it('sends a custom User-Agent', async () => {
    const { calls, fetchImpl } = fakeFetch(() => new Response('x', { status: 200 }));
    await fetchPage(URL_A, { fetchImpl, userAgent: 'custom-agent/9' });
    const headers = headersOf(calls[0]);
    expect(headers.get('user-agent')).toBe('custom-agent/9');
    expect(headers.get('accept')).toBe('text/html');
  });

  it.each([200, 201, 299])('treats status %i as ok', async (status) => {
    const { calls, fetchImpl } = fakeFetch(() => new Response(`<p>${status}</p>`, { status }));
    expect(await fetchPage(URL_A, { fetchImpl })).toEqual({
      kind: 'ok',
      html: `<p>${status}</p>`,
    });
    expect(calls).toHaveLength(1);
  });

  it.each([401, 403, 429, 503])(
    'reports status %i as blocked, with a single request',
    async (status) => {
      const { calls, fetchImpl } = fakeFetch(() => new Response('challenge', { status }));
      expect(await fetchPage(URL_A, { fetchImpl })).toEqual({
        kind: 'blocked',
        status,
      });
      expect(calls).toHaveLength(1);
    }
  );

  it.each([404, 410])('reports status %i as not found, with a single request', async (status) => {
    const { calls, fetchImpl } = fakeFetch(() => new Response('gone', { status }));
    expect(await fetchPage(URL_A, { fetchImpl })).toEqual({
      kind: 'not_found',
      status,
    });
    expect(calls).toHaveLength(1);
  });

  it.each([300, 400, 402, 405, 418, 500, 502, 504, 599])(
    'reports status %i as an error mentioning the status, with a single request',
    async (status) => {
      const { calls, fetchImpl } = fakeFetch(() => new Response('nope', { status }));
      const result = await fetchPage(URL_A, { fetchImpl });
      expect(result).toMatchObject({ kind: 'error', status });
      expect((result as { message?: string }).message).toContain(String(status));
      expect(calls).toHaveLength(1);
    }
  );

  it('reports a network failure as an error with a null status', async () => {
    const { calls, fetchImpl } = fakeFetch(() => {
      throw new Error('getaddrinfo ENOTFOUND reussir-tcfcanada.com');
    });
    expect(await fetchPage(URL_A, { fetchImpl })).toEqual({
      kind: 'error',
      status: null,
      message: 'getaddrinfo ENOTFOUND reussir-tcfcanada.com',
    });
    expect(calls).toHaveLength(1);
  });

  it('uses the global fetch by default', async () => {
    const { calls, fetchImpl } = fakeFetch(() => new Response('global', { status: 200 }));
    vi.stubGlobal('fetch', fetchImpl);
    expect(await fetchPage(URL_A)).toEqual({ kind: 'ok', html: 'global' });
    expect(calls).toHaveLength(1);
    expect(headersOf(calls[0]).get('user-agent')).toBe(DEFAULT_USER_AGENT);
  });
});
