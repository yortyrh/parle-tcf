import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCountdown } from './useCountdown';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCountdown', () => {
  it('returns null without a deadline and never expires', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useCountdown(null, onExpire));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.secondsLeft).toBeNull();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('counts down from the deadline and fires onExpire once at 0', () => {
    const onExpire = vi.fn();
    const deadline = Date.now() + 3000;
    const { result } = renderHook(() => useCountdown(deadline, onExpire));

    expect(result.current.secondsLeft).toBe(3);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.secondsLeft).toBe(2);
    act(() => {
      vi.advanceTimersByTime(1750);
    });
    expect(result.current.secondsLeft).toBe(1);
    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.secondsLeft).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('fires again for a new deadline and uses the latest callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ deadline, cb }) => useCountdown(deadline, cb), {
      initialProps: { deadline: Date.now() + 1000, cb: first },
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ deadline: Date.now() + 1000, cb: second });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('expires immediately for a deadline already past, without a callback too', () => {
    const { result } = renderHook(() => useCountdown(Date.now() - 1000));
    expect(result.current.secondsLeft).toBe(0);
  });
});
