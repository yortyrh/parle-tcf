import { Injectable, Logger } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import type {
  CreateExamSessionInput,
  CreateExamSessionOutput,
  RefreshSessionTokenInput,
  RefreshSessionTokenOutput,
  TaskType,
} from "@parle-tcf/shared";
import { AttemptsService } from "../attempts/attempts.service.js";
import { UsageService } from "../usage/usage.service.js";
import { ProviderSettingsService } from "../settings/provider-settings.service.js";
import {
  ProviderError,
  VoiceProviderRegistry,
} from "../providers/voice-provider.js";
import { ExamConfigService } from "../config/exam-config.service.js";
import {
  ExerciseService,
  taskNumber,
  type TcfExerciseRow,
} from "../exercise/exercise.service.js";

/** Default Live API model; override per user or with GEMINI_LIVE_MODEL. */
export const DEFAULT_GEMINI_LIVE_MODEL =
  "gemini-2.5-flash-native-audio-preview-09-2025";
const DEFAULT_GEMINI_VOICE = "Puck";

@Injectable()
export class ExamSessionService {
  private readonly logger = new Logger(ExamSessionService.name);

  constructor(
    private readonly exercises: ExerciseService,
    private readonly examConfig: ExamConfigService,
    private readonly settings: ProviderSettingsService,
    private readonly attempts: AttemptsService,
    private readonly usage: UsageService,
    private readonly voices: VoiceProviderRegistry,
  ) {}

  private resolveRealtimeModel(
    provider: "openai" | "gemini",
    configured: string | null,
    serviceModel: string,
  ): string {
    if (configured) return configured;
    if (provider === "gemini") {
      return process.env.GEMINI_LIVE_MODEL ?? DEFAULT_GEMINI_LIVE_MODEL;
    }
    if (serviceModel && serviceModel !== "realtime") return serviceModel;
    return process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-mini";
  }

  private resolveVoice(
    provider: { provider: "openai" | "gemini"; voice: string | null },
    serviceVoice: string,
  ): string {
    return (
      provider.voice ??
      (provider.provider === "gemini" ? DEFAULT_GEMINI_VOICE : serviceVoice)
    );
  }

  /** Mints a client secret; provider failures map to API errors. */
  private async mint(
    provider: { provider: "openai" | "gemini"; apiKey: string },
    model: string,
    voice: string,
  ): Promise<string> {
    try {
      return await this.voices
        .get(provider.provider)
        .mintClientSecret(provider.apiKey, { model, voice });
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
  }

  /**
   * A new client secret for an attempt in progress, asked right before the
   * voice session connects (after the preparation time): Gemini tokens must
   * open their session within minutes of being minted. The attempt's clock
   * starts here.
   */
  async refreshToken(
    userId: string,
    input: RefreshSessionTokenInput,
  ): Promise<RefreshSessionTokenOutput> {
    const attempt = await this.attempts.findOwned(userId, input.attemptId);
    if (attempt.status !== "in_progress") {
      throw new ORPCError("CONFLICT", {
        message: "Cette tentative est déjà terminée.",
      });
    }
    await this.usage.assertWithinLimits(userId);
    const provider = await this.settings.getConfigForUser(userId);
    if (provider.provider !== attempt.provider) {
      throw new ORPCError("CONFLICT", {
        message:
          "Le fournisseur a changé depuis le début de la tâche. Relancez la tâche.",
      });
    }
    const serviceYaml = this.examConfig.loadServiceConfig();
    const clientSecret = await this.mint(
      provider,
      attempt.model,
      this.resolveVoice(provider, serviceYaml.llm.voice),
    );
    await this.attempts.touchStart(userId, input.attemptId);
    return { clientSecret };
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
        ...subjectExtras(tcf),
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
        ...subjectExtras(tcf),
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

    await this.usage.assertWithinLimits(userId);

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

    const voice = this.resolveVoice(provider, serviceYaml.llm.voice);
    const model = this.resolveRealtimeModel(
      provider.provider,
      provider.realtimeModel,
      serviceYaml.llm.model,
    );

    const clientSecret = await this.mint(provider, model, voice);

    const attempt = await this.attempts.create({
      userId,
      mode,
      runId: runId ?? null,
      exerciseId: tcf?.id ?? null,
      task: taskNumber(taskType),
      model,
      provider: provider.provider,
    });

    return {
      provider: provider.provider,
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

/** Optional subject details sent to the client only when present. */
function subjectExtras(
  tcf: TcfExerciseRow | null,
): Pick<
  CreateExamSessionOutput["exerciseData"],
  "imageUrl" | "scenario" | "instruction"
> {
  return {
    ...(tcf?.imageUrl ? { imageUrl: tcf.imageUrl } : {}),
    ...(tcf?.scenario ? { scenario: tcf.scenario } : {}),
    ...(tcf?.instruction ? { instruction: tcf.instruction } : {}),
  };
}
