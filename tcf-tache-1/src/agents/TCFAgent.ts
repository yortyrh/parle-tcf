import { voice, type JobContext } from '@livekit/agents';
import { loadAgentConfig } from '@/config';
import type { TaskType, Mode, AgentConfig } from '@/config';
import type { TCFExercise } from '@/exercises/exerciseLoader';

/**
 * Agent TCF générique qui charge sa configuration depuis des fichiers YAML
 */
export class TCFAgent extends voice.Agent {
  private config: AgentConfig;
  private taskType: TaskType;
  private exercise: TCFExercise | null;

  constructor(taskType: TaskType, exercise: TCFExercise | null = null) {
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
    });

    this.config = config;
    this.taskType = taskType;
    this.exercise = exercise;
  }

  /**
   * Appelé quand l'agent entre dans la session
   */
  override async onEnter(): Promise<void> {
    // Construire le message de salutation, incluant l'exercice si disponible
    let greetingMessage = this.config.greeting;
    if (this.exercise && this.exercise.content) {
      greetingMessage += `\n\n${this.exercise.content}`;
    }
    
    await this.session.generateReply({
      allowInterruptions: false,
      instructions: greetingMessage
    });
  }

  /**
   * Obtient la durée de l'examen pour cette tâche
   */
  getDuration(): number {
    return this.config.durations.exam;
  }

  /**
   * Obtient le type de tâche de cet agent
   */
  getTaskType(): TaskType {
    return this.taskType;
  }

  /**
   * Obtient le mode de cet agent
   */
  getMode(): Mode {
    return this.mode;
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

  async sendDataMessage(context: JobContext, message: unknown): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(message));
    await context.room.localParticipant?.publishData(data, { reliable: true });
  }

  /**
   * Initialise l'écoute du timer pour le mode examen
   * Le timer démarre quand l'étudiant commence à parler
   * @param ctx Le contexte de la job LiveKit
   */
  initializeExamTimer(ctx: JobContext): void {

    let timerStarted = false;
    
    // Écouter la transcription de l'entrée utilisateur pour détecter quand l'étudiant commence à parler
    this.session.on(voice.AgentSessionEventTypes.UserInputTranscribed, async () => {
      if (!timerStarted) {
        timerStarted = true;
        
        try {
          if (this.config.durations.preparation > 0) {
            await this.sendDataMessage(ctx, {
              type: 'start_preparation_timer',
              currentTime: Date.now(),
              duration: this.config.durations.preparation
            });
            await new Promise(resolve => setTimeout(resolve, this.config.durations.preparation * 1000));
            await this.sendDataMessage(ctx, {
              type: 'end_preparation_timer',
            });
          }
          if (this.config.durations.exam > 0) {
            await this.sendDataMessage(ctx, {
              type: 'start_exam_timer',
              currentTime: Date.now(),
              duration: this.config.durations.exam
            });
            await new Promise(resolve => setTimeout(resolve, this.config.durations.exam * 1000));
            await this.sendDataMessage(ctx, {
              type: 'end_exam_timer',
            });
          }
        } catch (error) {
          console.error('Error sending timer messages:', error);
        }
      }
    });
  }
}
