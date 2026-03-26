import { type JobContext, llm, voice } from '@livekit/agents';
import { z } from 'zod';
import { loadAgentConfig } from '../config/index.js';
import type { AgentConfig, TaskType } from '../config/index.js';
import type { TCFExercise } from '../exercises/exerciseLoader.js';

/**
 * Agent TCF générique qui charge sa configuration depuis des fichiers YAML
 */
export class TCFAgent extends voice.Agent {
  private config: AgentConfig;
  private taskType: TaskType;
  private exercise: TCFExercise | null;

  constructor(
    taskType: TaskType,
    exercise: TCFExercise | null = null,
    private readonly context: JobContext | null = null,
  ) {
    // Charger la configuration depuis le fichier YAML
    const config = loadAgentConfig(taskType);

    // Construire les instructions complètes (toujours en mode exam)
    let fullInstructions = `${config.baseInstructions}\n\n${config.instructions}`;

    // Ajouter l'exercice sélectionné aux instructions si fourni
    if (exercise && exercise.content) {
      fullInstructions += `\n\nEXERCICE À UTILISER:\n${exercise.content}`;
    }

    // Initialiser l'agent avec la configuration
    super({
      allowInterruptions: config.settings.allowInterruptions,
      instructions: fullInstructions,
      tools: {
        envoiRapport: llm.tool({
          description: 'Envoie le rapport en format markdown à la fin de la session',
          parameters: z.object({
            report: z.string().describe('Le rapport à envoyer'),
          }),
          execute: async ({ report }) => {
            console.log('[envoiRapport] Envoi du rapport:', report);
            await this.sendDataMessage({
              type: 'report',
              report,
            });
          },
        }),
      },
    });

    this.config = config;
    this.taskType = taskType;
    this.exercise = exercise;
  }

  /**
   * Appelé quand l'agent entre dans la session
   */
  override async onEnter(): Promise<void> {
    // Envoyer les données de l'exercice au client web
    if (this.context) {
      await this.sendExerciseData();
    }

    // Construire le message de salutation, incluant l'exercice si disponible
    let greetingMessage = this.config.greeting;
    if (this.exercise && this.exercise.content) {
      greetingMessage += `\n\n${this.exercise.content}`;
    }

    const handleGreeting = this.session.generateReply({
      allowInterruptions: false,
      instructions: greetingMessage,
    });
    await handleGreeting.waitForPlayout();
  }

  /**
   * Obtient le type de tâche de cet agent
   */
  getTaskType(): TaskType {
    return this.taskType;
  }

  /**
   * Obtient la configuration complète de l'agent
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Obtient l'exercice associé à cet agent
   */
  getExercise(): TCFExercise | null {
    return this.exercise;
  }

  async sendDataMessage(message: unknown): Promise<void> {
    if (!this.context) return;
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(message));
    await this.context?.room.localParticipant?.publishData(data, { reliable: true });
  }

  /**
   * Envoie les données de l'exercice au client web
   */
  private async sendExerciseData(): Promise<void> {
    if (!this.context) return;

    // Déterminer le titre et la description en fonction du type de tâche
    let title: string;
    let description: string;

    if (this.taskType === 'tache1') {
      title = 'Tâche 1 - Entretien dirigé';
      description =
        'Présentation de soi, puis un entretien dirigé, exercice de conversation sur des sujets quotidiens';
    } else if (this.taskType === 'tache2') {
      title = 'Tâche 2 - Exercice en interaction';
      description =
        this.exercise?.content ||
        'Jeux de rôles, où on pose des questions pour obtenir des informations sur une situation quotidienne';
    } else if (this.taskType === 'tache3') {
      title = "Tâche 3 - Expression d'un point de vue";
      description =
        this.exercise?.content ||
        "Présentation d'un sujet, souvent lié à la vie quotidienne ou des débats de société";
    } else if (this.taskType === 'tef-section-a') {
      title = "TEF Section A - Demande d'informations";
      description =
        this.exercise?.consigne ||
        'Vous avez lu une annonce. Téléphonez pour obtenir des informations (~5 min)';
    } else if (this.taskType === 'tef-section-b') {
      title = 'TEF Section B - Argumentation';
      description =
        this.exercise?.consigne ||
        'Vous avez lu une annonce. Présentez-la à un(e) ami(e) et essayez de le/la convaincre (~10 min)';
    } else {
      title = 'Expression Orale';
      description = "Exercice d'expression orale";
    }

    const exerciseData = {
      type: 'exercise_data',
      data: {
        title,
        description,
        content: this.exercise?.content || '',
      },
    };

    console.log('[Exercise] Envoi des données:', exerciseData.data);
    await this.sendDataMessage(exerciseData);
  }
}
