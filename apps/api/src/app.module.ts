import { Module } from "@nestjs/common";
import { ORPCModule } from "@orpc/nest";
import { AppController } from "./app.controller.js";
import { ExamConfigService } from "./config/exam-config.service.js";
import { ExerciseService } from "./exercise/exercise.service.js";
import { EventsGateway } from "./gateway/events.gateway.js";
import { ExamController } from "./session/exam.controller.js";
import { ExamSessionService } from "./session/exam-session.service.js";

@Module({
  imports: [
    ORPCModule.forRoot({
      context: {},
    }),
  ],
  controllers: [AppController, ExamController],
  providers: [
    ExamConfigService,
    ExerciseService,
    ExamSessionService,
    EventsGateway,
  ],
})
export class AppModule {}
