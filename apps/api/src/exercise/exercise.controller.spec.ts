import { beforeEach, describe, expect, it, vi } from 'vitest';
import { call } from '@orpc/server';
import type { ExerciseSession, ListExercisesOutput } from '@parle-tcf/shared';
import { ExerciseController } from './exercise.controller.js';
import type { ExerciseService } from './exercise.service.js';

const LIST: ListExercisesOutput = {
  items: [
    {
      id: 't2-a',
      task: 2,
      prompt: 'Je suis votre voisin.',
      firstSeenOn: '2025-12-01',
      lastSeenOn: '2025-12-01',
      timesPublished: 1,
      isImageBased: false,
    },
  ],
  total: 1,
};
const SESSIONS: ExerciseSession[] = [{ id: 7, year: 2025, month: 12, tache2: 4, tache3: 2 }];

describe('ExerciseController handlers', () => {
  let exercises: {
    listExercises: ReturnType<typeof vi.fn>;
    listSessions: ReturnType<typeof vi.fn>;
  };
  let controller: ExerciseController;

  beforeEach(() => {
    exercises = {
      listExercises: vi.fn(async () => LIST),
      listSessions: vi.fn(async () => SESSIONS),
    };
    controller = new ExerciseController(exercises as unknown as ExerciseService);
  });

  describe('list', () => {
    it('lists with the default page and the trimmed search', async () => {
      expect(await call(controller.list(), { task: 2, search: '  école ' })).toEqual(LIST);
      expect(exercises.listExercises).toHaveBeenCalledWith({
        task: 2,
        search: 'école',
        limit: 20,
        offset: 0,
      });
    });

    it('passes the session filter and pagination through', async () => {
      await call(controller.list(), { task: 3, sessionId: 7, limit: 5, offset: 10 });
      expect(exercises.listExercises).toHaveBeenCalledWith({
        task: 3,
        sessionId: 7,
        limit: 5,
        offset: 10,
      });
    });

    it('rejects task 1 and an oversized page before reaching the service', async () => {
      await expect(call(controller.list(), { task: 1 } as never)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(call(controller.list(), { task: 2, limit: 101 })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      expect(exercises.listExercises).not.toHaveBeenCalled();
    });
  });

  describe('sessions', () => {
    it('wraps the sessions in an object', async () => {
      expect(await call(controller.sessions(), undefined)).toEqual({ sessions: SESSIONS });
      expect(exercises.listSessions).toHaveBeenCalledTimes(1);
    });

    it('returns an empty list for an empty bank', async () => {
      exercises.listSessions.mockResolvedValue([]);
      expect(await call(controller.sessions(), {})).toEqual({ sessions: [] });
    });
  });
});
