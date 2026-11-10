import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { call } from '@orpc/server';
import type { CreateExamSessionOutput } from '@parle-tcf/shared';
import { type AuthenticatedRequest, SessionAuthGuard } from '../auth/session-auth.guard.js';
import type { ExamSessionService } from './exam-session.service.js';
import { ExamController } from './exam.controller.js';

const USER = '11111111-1111-4111-8111-111111111111';
const ATTEMPT = '22222222-2222-4222-8222-222222222222';

const req = { user: { id: USER, email: 'a@test.local', name: 'A' } } as AuthenticatedRequest;

const SESSION: CreateExamSessionOutput = {
  provider: 'openai',
  clientSecret: 'ek_test',
  sessionId: 'sess_1',
  attemptId: ATTEMPT,
  runId: null,
  exerciseData: { title: 'Tâche 1', description: 'Entretien dirigé' },
  agentConfig: {
    instructions: 'Vous êtes examinateur.',
    greeting: 'Bonjour',
    voice: 'alloy',
    model: 'gpt-realtime-mini',
    allowInterruptions: true,
  },
};

describe('ExamController', () => {
  let examSession: {
    createSession: ReturnType<typeof vi.fn>;
    refreshToken: ReturnType<typeof vi.fn>;
  };
  let controller: ExamController;

  beforeEach(() => {
    examSession = {
      createSession: vi.fn(async () => SESSION),
      refreshToken: vi.fn(async () => ({ clientSecret: 'ek_fresh' })),
    };
    controller = new ExamController(examSession as unknown as ExamSessionService);
  });

  it('is behind SessionAuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ExamController)).toContain(SessionAuthGuard);
  });

  describe('createExamSession', () => {
    it('creates the session for the current user with defaults applied', async () => {
      expect(await call(controller.createExamSession(req), { taskType: 'tache1' })).toEqual(
        SESSION
      );
      expect(examSession.createSession).toHaveBeenCalledWith(USER, {
        taskType: 'tache1',
        mode: 'practice',
      });
    });

    it('passes the exercise, mode and run through', async () => {
      const input = {
        taskType: 'tache2' as const,
        exerciseId: 't2-a',
        mode: 'full' as const,
        runId: '33333333-3333-4333-8333-333333333333',
      };
      await call(controller.createExamSession(req), input);
      expect(examSession.createSession).toHaveBeenCalledWith(USER, input);
    });

    it('rejects an unknown task type before reaching the service', async () => {
      await expect(
        call(controller.createExamSession(req), { taskType: 'tache4' } as never)
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(examSession.createSession).not.toHaveBeenCalled();
    });

    it('propagates service errors (limits, missing key)', async () => {
      examSession.createSession.mockRejectedValue(new Error('limit reached'));
      await expect(
        call(controller.createExamSession(req), { taskType: 'tache1' })
      ).rejects.toThrow();
    });
  });

  describe('refreshSessionToken', () => {
    it('mints a fresh secret for the attempt of the current user', async () => {
      expect(await call(controller.refreshSessionToken(req), { attemptId: ATTEMPT })).toEqual({
        clientSecret: 'ek_fresh',
      });
      expect(examSession.refreshToken).toHaveBeenCalledWith(USER, { attemptId: ATTEMPT });
    });

    it('rejects a non-uuid attempt id', async () => {
      await expect(
        call(controller.refreshSessionToken(req), { attemptId: 'nope' })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      expect(examSession.refreshToken).not.toHaveBeenCalled();
    });
  });

  it('refuses both procedures without an authenticated user', () => {
    const anonymous = {} as AuthenticatedRequest;
    expect(() => controller.createExamSession(anonymous)).toThrow(UnauthorizedException);
    expect(() => controller.refreshSessionToken(anonymous)).toThrow(UnauthorizedException);
  });
});
