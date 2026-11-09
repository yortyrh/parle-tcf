import { Inject, Injectable, Logger } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import type {
  CreateExamSessionInput,
  CreateExamSessionOutput,
  TaskType,
} from "@parle-tcf/shared";
import { AttemptsService } from "../attempts/attempts.service.js";
import { ProviderSettingsService } from "../settings/provider-settings.service.js";
import {
  ProviderError,
  VOICE_PROVIDER,
  type VoiceProvider,
} from "../providers/voice-provider.js";
import { ExamConfigService } from "../config/exam-config.service.js";
import {
  ExerciseService,
  taskNumber,
  type TcfExerciseRow,
} from "../exercise/exercise.service.js";

@Injectable()
export class ExamSessionService {
  private readonly logger = new Logger(ExamSessionService.name);

  constructor(
    private readonly exercises: ExerciseService,
    private readonly examConfig: ExamConfigService,
    private readonly settings: ProviderSettingsService,
    private readonly attempts: AttemptsService,
    @Inject(VOICE_PROVIDER) private readonly voiceProvider: VoiceProvider,
  ) {}

  private resolveRealtimeModel(serviceModel: string): string {
    if (serviceModel && serviceModel !== "realtime") {
      return serviceModel;
    }
    return process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-mini";
  }

  private buildExerciseData(
    taskType: TaskType,
    tcf: TcfExerciseRow | null,
  ): CreateExamSessionOutput["exerciseData"] {
    if (taskType === "tache1") {
      return {
        title: "Tâche 1 - Entretien dirigé",
        description:
          "Présentation de soi, puis un entretien dirigé, exercice de conversation sur des sujets quotidiens",
        content: "",
        taskType,
      };
    }
    if (taskType === "tache2") {
      return {
        title: "Tâche 2 - Exercice en interaction",
        description:
          tcf?.content ??
          "Jeu de rôle — obtenir des informations sur une situation quotidienne",
        content: tcf?.content ?? "",
        exerciseId: tcf?.id,
        taskType,
      };
    }
    if (taskType === "tache3") {
      return {
        title: "Tâche 3 - Expression d'un point de vue",
        description:
          tcf?.content ??
          "Présentation d'un sujet, souvent lié à la vie quotidienne ou des débats de société",
        content: tcf?.content ?? "",
        exerciseId: tcf?.id,
        taskType,
      };
    }
    return {
      title: "Expression Orale",
      description: "Exercice d'expression orale",
      taskType,
    };
  }

  private buildFullInstructions(
    taskType: TaskType,
    agentYaml: { baseInstructions: string; instructions: string },
    contentAppend: string | undefined,
  ): string {
    let full = `${agentYaml.baseInstructions}\n\n${agentYaml.instructions}`;
    if (contentAppend) {
      // Tâche 1 reçoit une banque de questions de référence; les autres tâches reçoivent
      // l'énoncé d'exercice à dérouler. Le libellé guide le modèle sur l'usage attendu.
      const label =
        taskType === "tache1"
          ? "BANQUE DE QUESTIONS DE RÉFÉRENCE (à puiser, à varier, à ne JAMAIS lire ni énumérer au candidat)"
          : "EXERCICE À UTILISER";
      full += `\n\n${label}:\n${contentAppend}`;
    }
    return full;
  }

  async createSession(
    userId: string,
    input: CreateExamSessionInput,
  ): Promise<CreateExamSessionOutput> {
    const { taskType, exerciseId, mode, runId } = input;
    const agentYaml = this.examConfig.loadAgentConfig(taskType);
    const serviceYaml = this.examConfig.loadServiceConfig();

    // Fails fast with PROVIDER_NOT_CONFIGURED before any other work.
    const provider = await this.settings.getConfigForUser(userId);

    if (provider.provider !== "openai") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Ce fournisseur n'est pas encore pris en charge.",
      });
    }

    const tcf = await this.exercises.resolveExerciseForTask(
      taskType,
      exerciseId,
    );
    if (exerciseId && !tcf) {
      throw new ORPCError("NOT_FOUND", { message: "Exercice introuvable." });
    }

    const exerciseData = this.buildExerciseData(taskType, tcf);
    const orderedExerciseIds =
      await this.exercises.listOrderedExerciseIds(taskType);
    const contentForInstructions =
      taskType === "tache1"
        ? this.examConfig.loadInfoMarkdown("questions-tache1-entretien.md")
        : exerciseData.content && exerciseData.content.length > 0
          ? exerciseData.content
          : undefined;

    const instructions = this.buildFullInstructions(
      taskType,
      agentYaml,
      contentForInstructions,
    );

    const voice = provider.voice ?? serviceYaml.llm.voice;
    const model = this.resolveRealtimeModel(
      provider.realtimeModel ?? serviceYaml.llm.model,
    );

    let clientSecret: string;
    try {
      clientSecret = await this.voiceProvider.mintClientSecret(
        provider.apiKey,
        { model, voice },
      );
    } catch (error) {
      if (error instanceof ProviderError) {
        throw new ORPCError(
          error.status === 401 ? "PROVIDER_KEY_REJECTED" : "BAD_GATEWAY",
          {
            status: error.status === 401 ? 422 : 502,
            message: error.message,
          },
        );
      }
      throw error;
    }

    const attempt = await this.attempts.create({
      userId,
      mode,
      runId: runId ?? null,
      exerciseId: tcf?.id ?? null,
      task: taskNumber(taskType),
      model,
    });

    return {
      clientSecret,
      sessionId: randomUUID(),
      attemptId: attempt.id,
      runId: attempt.runId,
      exerciseData,
      orderedExerciseIds,
      agentConfig: {
        instructions,
        greeting: agentYaml.greeting,
        voice,
        model,
        allowInterruptions: agentYaml.settings.allowInterruptions,
      },
    };
  }
}
