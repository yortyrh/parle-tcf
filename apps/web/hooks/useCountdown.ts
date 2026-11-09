import { useEffect, useRef, useState } from 'react';

/** Whole seconds left until `deadlineMs`, never negative. */
export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/**
 * Counts down to an absolute deadline (epoch ms). Based on the deadline, not on
 * accumulated ticks, so it stays accurate when the tab is throttled.
 * `onExpire` fires once per deadline.
 */
export function useCountdown(deadlineMs: number | null, onExpire?: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const expiredForRef = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (deadlineMs === null) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [deadlineMs]);

  const secondsLeft = deadlineMs === null ? null : remainingSeconds(deadlineMs, now);

  useEffect(() => {
    if (deadlineMs === null || secondsLeft !== 0) return;
    if (expiredForRef.current === deadlineMs) return;
    expiredForRef.current = deadlineMs;
    onExpireRef.current?.();
  }, [deadlineMs, secondsLeft]);

  return { secondsLeft };
}
