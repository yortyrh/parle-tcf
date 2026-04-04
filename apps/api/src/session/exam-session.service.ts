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

/**
 * Appended after per-exercise markdown so it overrides contradictory lines
 * (e.g. “répondre que ce n’est pas sur l’annonce”) that older generated files may contain.
 */
const TEF_SECTION_A_INSTRUCTION_CLOSING = `

---
RAPPEL FINAL — Section A (prime sur toute phrase du bloc « EXERCICE À UTILISER » qui suggérerait un refus d’information) :

Pendant l’appel, ne bloque pas l’échange en renvoyant le candidat à l’affiche, au site, à un courriel, à « appeler ailleurs » ou à un autre service comme seule réponse, ni en répétant que le détail « n’est pas sur l’annonce », « n’est pas écrit », « vous auriez dû lire » ou équivalent. Ce ton est pédagogiquement contre-productif et tue l’oral.

À la place, reste entièrement dans le personnage : réponds aux questions, y compris lorsque le point ne figure pas clairement sur la fiche du candidat. Donne une information courte et crédible qu’un interlocuteur au téléphone fournirait, ou une suite naturelle (prise de note, vérification, « pour votre situation on fait comme ceci », rappel avec le détail, précision d’usage), en restant cohérent avec l’annonce et les faits de l’exercice. Les mentions « (illisible sur le scan) » indiquent ce que le candidat ne voit pas sur son document ; elles n’obligent pas à refuser la réponse : au téléphone tu peux préciser ces points comme le ferait le service.

L’évaluation pourra noter dans le rapport si une question visait une info hors fiche ; pendant l’épreuve, le personnage accueille et répond sans moraliser sur la démarche à suivre.`;

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
    let full = `${agentYaml.baseInstructions}\n\n${agentYaml.instructions}`;
    if (contentAppend) {
      full += `\n\nEXERCICE À UTILISER:\n${contentAppend}`;
      if (taskType === "tef-section-a") {
        full += TEF_SECTION_A_INSTRUCTION_CLOSING;
      }
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
