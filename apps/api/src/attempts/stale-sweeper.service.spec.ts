import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvaluationService } from '../evaluation/evaluation.service.js';
import type { AttemptsService } from './attempts.service.js';
import { StaleSweeperService } from './stale-sweeper.service.js';

const FIVE_MIN = 5 * 60_000;

describe('StaleSweeperService', () => {
  // One object serves as both dependencies, so the test does not depend on the
  // constructor's parameter order.
  let deps: {
    failStale: ReturnType<typeof vi.fn>;
    interruptStale: ReturnType<typeof vi.fn>;
  };
  let sweeper: StaleSweeperService;

  beforeEach(() => {
    deps = {
      failStale: vi.fn(async () => undefined),
      interruptStale: vi.fn(async () => 0),
    };
    sweeper = new StaleSweeperService(
      deps as unknown as EvaluationService,
      deps as unknown as AttemptsService
    );
  });
  afterEach(() => {
    sweeper.onModuleDestroy();
    vi.useRealTimers();
  });

  it('fails stale evaluations and interrupts stale attempts with the same clock', async () => {
    const now = new Date('2026-03-10T12:00:00.000Z');
    await sweeper.sweep(now);
    expect(deps.failStale).toHaveBeenCalledTimes(1);
    expect(deps.failStale).toHaveBeenCalledWith(now);
    expect(deps.interruptStale).toHaveBeenCalledTimes(1);
    expect(deps.interruptStale).toHaveBeenCalledWith(now);
  });

  it('defaults to the current time', async () => {
    const before = Date.now();
    await sweeper.sweep();
    const failAt = (deps.failStale.mock.calls[0]?.[0] as Date).getTime();
    const interruptAt = (deps.interruptStale.mock.calls[0]?.[0] as Date).getTime();
    expect(failAt).toBeGreaterThanOrEqual(before);
    expect(failAt).toBeLessThanOrEqual(Date.now());
    expect(interruptAt).toBe(failAt);
  });

  it('sweeps at startup, then every 5 minutes until destroyed', async () => {
    vi.useFakeTimers();
    await sweeper.onModuleInit();
    expect(deps.failStale).toHaveBeenCalledTimes(1);
    expect(deps.interruptStale).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(FIVE_MIN - 1);
    expect(deps.interruptStale).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(deps.failStale).toHaveBeenCalledTimes(2);
    expect(deps.interruptStale).toHaveBeenCalledTimes(2);

    sweeper.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(3 * FIVE_MIN);
    expect(deps.interruptStale).toHaveBeenCalledTimes(2);
  });

  it('keeps sweeping after a failed sweep', async () => {
    vi.useFakeTimers();
    await sweeper.onModuleInit();
    deps.failStale.mockRejectedValueOnce(new Error('db down'));
    await vi.advanceTimersByTimeAsync(FIVE_MIN);
    await vi.advanceTimersByTimeAsync(FIVE_MIN);
    expect(deps.failStale).toHaveBeenCalledTimes(3);
  });
});
