import { beforeEach, describe, expect, it, vi } from 'vitest';
import { call } from '@orpc/server';
import type { ExamRun } from '@parle-tcf/shared';
import type { AudioService } from '../audio/audio.service.js';
import type { AuthenticatedRequest } from '../auth/session-auth.guard.js';
import type { EvaluationService } from '../evaluation/evaluation.service.js';
import type { UsageService } from '../usage/usage.service.js';
import { AttemptsController } from './attempts.controller.js';
import type { AttemptsService } from './attempts.service.js';

const USER = '11111111-1111-4111-8111-111111111111';
const ATTEMPT = '22222222-2222-4222-8222-222222222222';
const RUN = '33333333-3333-4333-8333-333333333333';

const req = {
  user: { id: USER, email: 'a@test.local', name: 'A' },
} as unknown as AuthenticatedRequest;

describe('AttemptsController', () => {
  let order: string[];
  let attempts: {
    complete: ReturnType<typeof vi.fn>;
    checkpoint: ReturnType<typeof vi.fn>;
    getRun: ReturnType<typeof vi.fn>;
  };
  let evaluation: {
    start: ReturnType<typeof vi.fn>;
    requeue: ReturnType<typeof vi.fn>;
  };
  let usage: { isOverLimit: ReturnType<typeof vi.fn> };
  let controller: AttemptsController;

  beforeEach(() => {
    order = [];
    attempts = {
      complete: vi.fn(),
      checkpoint: vi.fn(async () => {
        order.push('checkpoint');
      }),
      getRun: vi.fn(),
    };
    evaluation = { start: vi.fn(), requeue: vi.fn() };
    usage = {
      isOverLimit: vi.fn(async () => {
        order.push('isOverLimit');
        return false;
      }),
    };
    controller = new AttemptsController(
      attempts as unknown as AttemptsService,
      evaluation as unknown as EvaluationService,
      usage as unknown as UsageService,
      {} as AudioService
    );
  });

  describe('complete', () => {
    const input = {
      attemptId: ATTEMPT,
      lines: [{ seq: 0, speaker: 'candidate' as const, text: 'Bonjour' }],
    };

    it('starts the evaluation when the attempt was just completed', async () => {
      attempts.complete.mockResolvedValue(true);
      expect(await call(controller.complete(req), input)).toEqual({ ok: true });
      expect(attempts.complete.mock.calls[0]?.slice(0, 2)).toEqual([USER, input]);
      expect(evaluation.start).toHaveBeenCalledTimes(1);
      expect(evaluation.start).toHaveBeenCalledWith(USER, ATTEMPT);
    });

    it('does not start a second evaluation for an already completed attempt', async () => {
      attempts.complete.mockResolvedValue(false);
      expect(await call(controller.complete(req), input)).toEqual({ ok: true });
      expect(evaluation.start).not.toHaveBeenCalled();
    });

    it('does not start an evaluation when completing fails', async () => {
      attempts.complete.mockRejectedValue(new Error('boom'));
      await expect(call(controller.complete(req), input)).rejects.toThrow();
      expect(evaluation.start).not.toHaveBeenCalled();
    });
  });

  describe('checkpoint', () => {
    const input = {
      attemptId: ATTEMPT,
      lines: [{ seq: 3, speaker: 'examiner' as const, text: 'Continuez' }],
    };

    it.each([true, false])('reports limitReached=%s after saving', async (reached) => {
      usage.isOverLimit.mockImplementation(async () => {
        order.push('isOverLimit');
        return reached;
      });
      expect(await call(controller.checkpoint(req), input)).toEqual({
        ok: true,
        limitReached: reached,
      });
      expect(attempts.checkpoint.mock.calls[0]?.slice(0, 3)).toEqual([USER, ATTEMPT, input.lines]);
      expect(usage.isOverLimit.mock.calls[0]?.[0]).toBe(USER);
      expect(order).toEqual(['checkpoint', 'isOverLimit']);
    });
  });

  describe('reevaluate', () => {
    it('returns ok when the evaluation is queued', async () => {
      evaluation.requeue.mockResolvedValue('queued');
      expect(await call(controller.reevaluate(req), { attemptId: ATTEMPT })).toEqual({ ok: true });
      expect(evaluation.requeue).toHaveBeenCalledWith(USER, ATTEMPT);
    });

    it('maps not_found to NOT_FOUND', async () => {
      evaluation.requeue.mockResolvedValue('not_found');
      await expect(call(controller.reevaluate(req), { attemptId: ATTEMPT })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('maps running to CONFLICT (409)', async () => {
      evaluation.requeue.mockResolvedValue('running');
      await expect(call(controller.reevaluate(req), { attemptId: ATTEMPT })).rejects.toMatchObject({
        code: 'CONFLICT',
        status: 409,
      });
    });
  });

  describe('runsGet', () => {
    it("returns the user's run", async () => {
      const run: ExamRun = {
        id: RUN,
        mode: 'full',
        startedAt: '2026-03-10T10:00:00.000Z',
        finishedAt: null,
        globalLevel: null,
        attempts: [],
      };
      attempts.getRun.mockResolvedValue(run);
      expect(await call(controller.runsGet(req), { runId: RUN })).toEqual(run);
      expect(attempts.getRun).toHaveBeenCalledWith(USER, RUN);
    });
  });
});
