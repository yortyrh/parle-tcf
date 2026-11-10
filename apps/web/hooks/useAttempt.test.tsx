import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttemptDetail } from '@parle-tcf/shared';
import { act, renderHook } from '@testing-library/react';
import { api } from '@/lib/api';
import { useAttempt } from './useAttempt';

vi.mock('@/lib/api', () => ({ api: { getAttempt: vi.fn() } }));

const getAttempt = vi.mocked(api.getAttempt);

function attempt(evaluationStatus: AttemptDetail['evaluationStatus']): AttemptDetail {
  return { id: 'a1', evaluationStatus } as AttemptDetail;
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  getAttempt.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAttempt', () => {
  it('loads the attempt by id', async () => {
    getAttempt.mockResolvedValue(attempt('done'));
    const { result } = renderHook(() => useAttempt('a1'));
    await flush();
    expect(getAttempt).toHaveBeenCalledWith('a1');
    expect(result.current.attempt?.evaluationStatus).toBe('done');
    expect(result.current.error).toBeNull();
  });

  it.each(['pending', 'running'] as const)(
    'polls every 2 s while the evaluation is %s',
    async (s) => {
      getAttempt.mockResolvedValue(attempt(s));
      renderHook(() => useAttempt('a1'));
      await flush();
      expect(getAttempt).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1999);
      });
      expect(getAttempt).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(getAttempt).toHaveBeenCalledTimes(2);
    }
  );

  it('stops polling once the evaluation is settled', async () => {
    getAttempt.mockResolvedValueOnce(attempt('running')).mockResolvedValue(attempt('done'));
    const { result } = renderHook(() => useAttempt('a1'));
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.attempt?.evaluationStatus).toBe('done');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getAttempt).toHaveBeenCalledTimes(2);
  });

  it.each(['done', 'failed'] as const)('does not poll a %s evaluation', async (s) => {
    getAttempt.mockResolvedValue(attempt(s));
    renderHook(() => useAttempt('a1'));
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getAttempt).toHaveBeenCalledTimes(1);
  });

  it('exposes the error message, then clears it after a successful refresh', async () => {
    getAttempt.mockRejectedValueOnce(new Error('Introuvable')).mockResolvedValue(attempt('done'));
    const { result } = renderHook(() => useAttempt('a1'));
    await flush();
    expect(result.current.error).toBe('Introuvable');
    expect(result.current.attempt).toBeNull();

    await act(() => result.current.refresh());
    expect(result.current.error).toBeNull();
    expect(result.current.attempt?.id).toBe('a1');
  });

  it('uses a generic French message for non-Error failures', async () => {
    getAttempt.mockRejectedValue('boom');
    const { result } = renderHook(() => useAttempt('a1'));
    await flush();
    expect(result.current.error).toBe('Erreur de chargement.');
  });

  it('stops polling on unmount', async () => {
    getAttempt.mockResolvedValue(attempt('pending'));
    const { unmount } = renderHook(() => useAttempt('a1'));
    await flush();
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getAttempt).toHaveBeenCalledTimes(1);
  });
});
