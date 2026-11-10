import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_TOKEN_KEY } from './session-token';

interface AuthClientConfig {
  baseURL: string;
  fetchOptions: {
    credentials: string;
    auth: { type: string; token: () => string };
    onSuccess: (ctx: { response: Response }) => void;
  };
}

const captured = vi.hoisted(() => {
  const state: { config: unknown } = { config: null };
  return state;
});

vi.mock('better-auth/react', () => ({
  createAuthClient: (config: unknown) => {
    captured.config = config;
    return { config };
  },
}));

function fakeStorage(): Storage {
  const map = new Map<string, string>();
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

let storage: Storage;

async function loadConfig(): Promise<AuthClientConfig> {
  vi.resetModules();
  await import('./auth-client');
  return captured.config as AuthClientConfig;
}

beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubEnv('NEXT_PUBLIC_EXAM_API_URL', 'https://api.example.test/');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('authClient', () => {
  it('talks to the API in bearer mode, without cookies', async () => {
    const config = await loadConfig();
    expect(config.baseURL).toBe('https://api.example.test');
    expect(config.fetchOptions.credentials).toBe('omit');
    expect(config.fetchOptions.auth.type).toBe('Bearer');
  });

  it('sends the stored token, or an empty one when signed out', async () => {
    const { fetchOptions } = await loadConfig();
    expect(fetchOptions.auth.token()).toBe('');
    storage.setItem(SESSION_TOKEN_KEY, 'tok-1');
    expect(fetchOptions.auth.token()).toBe('tok-1');
  });

  it('stores the token returned in set-auth-token', async () => {
    const { fetchOptions } = await loadConfig();
    fetchOptions.onSuccess({
      response: new Response(null, { headers: { 'set-auth-token': 'tok-new' } }),
    });
    expect(storage.getItem(SESSION_TOKEN_KEY)).toBe('tok-new');
  });

  it('keeps the current token when the response has none', async () => {
    storage.setItem(SESSION_TOKEN_KEY, 'tok-1');
    const { fetchOptions } = await loadConfig();
    fetchOptions.onSuccess({ response: new Response(null) });
    expect(storage.getItem(SESSION_TOKEN_KEY)).toBe('tok-1');
  });
});
