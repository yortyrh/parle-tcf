import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SESSION_TOKEN_KEY,
  authHeaders,
  clearSessionToken,
  getSessionToken,
  saveSessionToken,
} from './session-token';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
    clear: vi.fn(() => data.clear()),
    key: vi.fn(() => null),
    get length() {
      return data.size;
    },
  };
}

function throwingStorage() {
  const fail = () => {
    throw new Error('SecurityError: storage disabled');
  };
  return {
    getItem: vi.fn(fail),
    setItem: vi.fn(fail),
    removeItem: vi.fn(fail),
    clear: vi.fn(fail),
    key: vi.fn(fail),
    length: 0,
  };
}

function installStorage(storage: unknown) {
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
}

describe('session token storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the parle-tcf.session_token key', () => {
    expect(SESSION_TOKEN_KEY).toBe('parle-tcf.session_token');
  });

  describe('in a browser', () => {
    let storage: ReturnType<typeof memoryStorage>;

    beforeEach(() => {
      storage = memoryStorage();
      installStorage(storage);
    });

    it('returns null when no token is stored', () => {
      expect(getSessionToken()).toBeNull();
    });

    it('reads the token from its key', () => {
      storage.data.set('parle-tcf.session_token', 'tok-123');
      storage.data.set('other', 'nope');
      expect(getSessionToken()).toBe('tok-123');
      expect(storage.getItem).toHaveBeenCalledWith('parle-tcf.session_token');
    });

    it('saves and reads back a token', () => {
      saveSessionToken('tok-abc');
      expect(storage.setItem).toHaveBeenCalledWith('parle-tcf.session_token', 'tok-abc');
      expect(getSessionToken()).toBe('tok-abc');
    });

    it('ignores an empty token', () => {
      storage.data.set('parle-tcf.session_token', 'existing');
      saveSessionToken('');
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(getSessionToken()).toBe('existing');
    });

    it('clears the token', () => {
      saveSessionToken('tok-abc');
      clearSessionToken();
      expect(storage.removeItem).toHaveBeenCalledWith('parle-tcf.session_token');
      expect(storage.data.has('parle-tcf.session_token')).toBe(false);
      expect(getSessionToken()).toBeNull();
    });

    it('builds a bearer header when a token exists', () => {
      saveSessionToken('tok-xyz');
      expect(authHeaders()).toEqual({ Authorization: 'Bearer tok-xyz' });
    });

    it('builds no header without a token', () => {
      expect(authHeaders()).toEqual({});
    });

    it('builds no header after the token is cleared', () => {
      saveSessionToken('tok-xyz');
      clearSessionToken();
      expect(authHeaders()).toEqual({});
    });
  });

  describe('when storage throws', () => {
    beforeEach(() => {
      installStorage(throwingStorage());
    });

    it('reads null', () => {
      expect(getSessionToken()).toBeNull();
    });

    it('swallows save errors', () => {
      expect(() => saveSessionToken('tok')).not.toThrow();
    });

    it('swallows clear errors', () => {
      expect(() => clearSessionToken()).not.toThrow();
    });

    it('builds no header', () => {
      expect(authHeaders()).toEqual({});
    });
  });

  describe('on the server', () => {
    it('reads null when window and localStorage are undefined', () => {
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('localStorage', undefined);
      expect(getSessionToken()).toBeNull();
      expect(authHeaders()).toEqual({});
      expect(() => saveSessionToken('tok')).not.toThrow();
      expect(() => clearSessionToken()).not.toThrow();
    });

    it('reads null when window exists without localStorage', () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('localStorage', undefined);
      expect(getSessionToken()).toBeNull();
      expect(() => saveSessionToken('tok')).not.toThrow();
    });
  });
});
