import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { exercisesListProcedure, exercisesSessionsProcedure } from '../contract/exam.contract.js';
import { ExerciseService } from './exercise.service.js';

/** Topic browser: months of published subjects and the subjects of a task. */
@Controller()
@UseGuards(SessionAuthGuard)
export class ExerciseController {
  constructor(private readonly exercises: ExerciseService) {}

  @Implement(exercisesListProcedure)
  list() {
    return implement(exercisesListProcedure).handler(({ input }) =>
      this.exercises.listExercises(input)
    );
  }

  @Implement(exercisesSessionsProcedure)
  sessions() {
    return implement(exercisesSessionsProcedure).handler(async () => ({
      sessions: await this.exercises.listSessions(),
    }));
  }
}
