import { Injectable, Logger } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import type {
  CreateExamSessionInput,
  CreateExamSessionOutput,
  ExerciseImagePayload,
  TaskType,
} from "@yorty-tcf/shared";
import { ExamConfigService } from "../config/exam-config.service.js";
import {
  ExerciseService,
  type TcfExerciseRow,
  type TefExercise,
} from "../exercise/exercise.service.js";

@Injectable()
export class ExamSessionService {
  private readonly logger = new Logger(ExamSessionService.name);

  constructor(
    private readonly exercises: ExerciseService,
    private readonly examConfig: ExamConfigService,
  ) {}

  private resolveRealtimeModel(serviceModel: string): string {
    if (serviceModel && serviceModel !== "realtime") {
      return serviceModel;
    }
    return (
      process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview-2024-12-17"
    );
  }

  private async mintOpenAiClientSecret(params: {
    model: string;
    voice: string;
  }): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "OPENAI_API_KEY is not configured",
      });
    }

    const body = {
      session: {
        type: "realtime",
        model: params.model,
        audio: {
          output: { voice: params.voice },
        },
      },
    };

    const res = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.error("OpenAI client_secrets failed", data);
      throw new ORPCError("BAD_GATEWAY", {
        message: `OpenAI client_secrets: ${res.status}`,
      });
    }

    const secret =
      (typeof data.value === "string" && data.value) ||
      (typeof (data as { client_secret?: { value?: string } }).client_secret
        ?.value === "string" &&
        (data as { client_secret: { value: string } }).client_secret.value);

    if (!secret) {
      this.logger.error("Unexpected client_secrets response", data);
      throw new ORPCError("BAD_GATEWAY", {
        message: "OpenAI client_secrets: missing ephemeral value",
      });
    }

    return secret;
  }

  private buildExerciseData(
    taskType: TaskType,
    tcf: TcfExerciseRow | null,
    tef: TefExercise | null,
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
    if (taskType === "tef-section-a") {
      return {
        title: "TEF Section A - Demande d'informations",
        description: "Demande d'informations par téléphone",
        content: tef?.instructions ?? "",
        exerciseId: tef?.id,
        taskType,
      };
    }
    if (taskType === "tef-section-b") {
      return {
        title: "TEF Section B - Argumentation",
        description: "Argumentation avec un(e) ami(e)",
        content: tef?.instructions ?? "",
        exerciseId: tef?.id,
        taskType,
      };
    }
    return {
      title: "Expression Orale",
      description: "Exercice d'expression orale",
      taskType,
    };
  }

  private buildTefImagePayload(
    tef: TefExercise,
    section: "A" | "B",
  ): ExerciseImagePayload {
    return {
      type: "exerciseImage",
      id: tef.id,
      filename: tef.filename,
      section,
    };
  }

  private buildFullInstructions(
    taskType: TaskType,
    agentYaml: { baseInstructions: string; instructions: string },
    contentAppend: string | undefined,
  ): string {
    // TEF: `tef-exercices` .md files are self-contained system prompts (YAML + EXERCICE À UTILISER + body).
    if (
      (taskType === "tef-section-a" || taskType === "tef-section-b") &&
      contentAppend
    ) {
      return contentAppend;
    }
    let full = `${agentYaml.baseInstructions}\n\n${agentYaml.instructions}`;
    if (contentAppend) {
      full += `\n\nEXERCICE À UTILISER:\n${contentAppend}`;
    }
    return full;
  }

  async createSession(
    input: CreateExamSessionInput,
  ): Promise<CreateExamSessionOutput> {
    const { taskType, exerciseId } = input;
    const agentYaml = this.examConfig.loadAgentConfig(taskType);
    const serviceYaml = this.examConfig.loadServiceConfig();

    const { tcf, tef } = this.exercises.resolveExerciseForTask(
      taskType,
      exerciseId,
    );

    let exerciseImage: ExerciseImagePayload | null = null;
    if (taskType === "tef-section-a" && tef) {
      exerciseImage = this.buildTefImagePayload(tef, "A");
    } else if (taskType === "tef-section-b" && tef) {
      exerciseImage = this.buildTefImagePayload(tef, "B");
    }

    const exerciseData = this.buildExerciseData(taskType, tcf, tef);
    const contentForInstructions =
      taskType === "tache1"
        ? undefined
        : exerciseData.content && exerciseData.content.length > 0
          ? exerciseData.content
          : undefined;

    const instructions = this.buildFullInstructions(
      taskType,
      agentYaml,
      contentForInstructions,
    );

    const voice = serviceYaml.llm.voice;
    const model = this.resolveRealtimeModel(serviceYaml.llm.model);

    const clientSecret = await this.mintOpenAiClientSecret({ model, voice });

    const sessionId = randomUUID();

    return {
      clientSecret,
      sessionId,
      exerciseData,
      exerciseImage,
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
