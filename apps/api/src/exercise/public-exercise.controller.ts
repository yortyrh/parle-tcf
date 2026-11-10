import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { exercisesFeaturedProcedure } from "../contract/exam.contract.js";
import { ExerciseService } from "./exercise.service.js";

/**
 * Public routes (no session) used by the landing page. Only the teaser of the
 * latest month is exposed; the full bank stays behind the session guard.
 */
@Controller()
export class PublicExerciseController {
  constructor(private readonly exercises: ExerciseService) {}

  @Implement(exercisesFeaturedProcedure)
  featured() {
    return implement(exercisesFeaturedProcedure).handler(() =>
      this.exercises.featured(),
    );
  }
}
