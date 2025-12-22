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
  private mode: Mode;
  private exercise: TCFExercise | null;

  constructor(taskType: TaskType, exercise: TCFExercise | null = null) {
    // Charger la configuration depuis le fichier YAML
    const config = loadAgentConfig(taskType);

    // Construire les instructions complètes (toujours en mode exam)
    const modeConfig = config.examMode;
    let fullInstructions = `${config.baseInstructions}\n\n${modeConfig.instructions}`;

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
    this.mode = 'exam'; // Toujours en mode exam
    this.exercise = exercise;
  }

  /**
   * Appelé quand l'agent entre dans la session
   */
  override async onEnter(): Promise<void> {
    const modeConfig = this.config.examMode;
    
    // Construire le message de salutation, incluant l'exercice si disponible
    let greetingMessage = modeConfig.greeting;
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
          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify({
            type: 'start_timer',
            currentTime: Date.now(),
            duration: this.getDuration(),
            message: 'Le chronomètre démarre'
          }));
          await ctx.room.localParticipant?.publishData(data, { reliable: true });

          if (this.config.examMode.endExamMessage) {
            const endExamMessage: string = this.config.examMode.endExamMessage;
            setTimeout(async () => {
              // Générer un message audio de fin d'examen
              console.log('Générer un message audio de fin d\'examen : ', endExamMessage);
              this.session.interrupt();
              const handle = this.session.generateReply({
                instructions: endExamMessage
              });
              await handle.waitForPlayout();
            }, this.getDuration() * 1000);
          }
        } catch (error) {
          console.error('Error sending start_timer:', error);
        }
      }
    });
  }
}
