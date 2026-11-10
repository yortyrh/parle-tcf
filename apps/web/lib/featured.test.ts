import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ROUTES } from '@parle-tcf/shared';
import { getFeaturedExercises } from './featured';

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

describe('getFeaturedExercises', () => {
  it('posts to the featured route with an hourly revalidation and returns the body', async () => {
    const featured = { session: null, items: [] };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(featured), { status: 200 }));

    await expect(getFeaturedExercises()).resolves.toEqual(featured);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { next?: unknown }];
    expect(url).toBe(`https://api.example.test${API_ROUTES.exercisesFeatured}`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    expect(init.next).toEqual({ revalidate: 3600 });
  });

  it('returns null on a non-OK response', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(getFeaturedExercises()).resolves.toBeNull();
  });

  it('returns null when the API is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getFeaturedExercises()).resolves.toBeNull();
  });
});
