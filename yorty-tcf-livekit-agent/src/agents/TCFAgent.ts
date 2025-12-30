import { voice, type JobContext } from '@livekit/agents';
import { loadAgentConfig } from '../config/index.js';
import type { TaskType, AgentConfig } from '../config/index.js';
import type { TCFExercise } from '../exercises/exerciseLoader.js';

/**
 * Agent TCF générique qui charge sa configuration depuis des fichiers YAML
 */
export class TCFAgent extends voice.Agent {
  private config: AgentConfig;
  private taskType: TaskType;
  private exercise: TCFExercise | null;
  // États pour la gestion des timers
  private timerState: 'idle' | 'preparation' | 'exam' | 'finished' = 'idle';
  private preparationTimerTimeout: NodeJS.Timeout | null = null;
  private examTimerTimeout: NodeJS.Timeout | null = null;

  constructor(taskType: TaskType, exercise: TCFExercise | null = null, private readonly context: JobContext | null = null) {
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
      instructions: greetingMessage
    });
    await handleGreeting.waitForPlayout();

    console.error('[Timer] Greeting terminé');

    // Démarrer le timer de préparation si nécessaire après le greeting
    if (this.config.durations.preparation > 0 && this.context) {
      console.log('[Timer] Greeting terminé, démarrage de la préparation');
      await this.startPreparationTimer();
    }
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
   * Envoie les données de l'exercice au client web
   */
  private async sendExerciseData(): Promise<void> {
    if (!this.context) return;

    // Déterminer le titre et la description en fonction du type de tâche
    let title: string;
    let description: string;

    if (this.taskType === 'tache1') {
      title = 'Tâche 1 - Entretien dirigé';
      description = 'Présentation de soi, puis un entretien dirigé, exercice de conversation sur des sujets quotidiens';
    } else if (this.taskType === 'tache2') {
      title = 'Tâche 2 - Exercice en interaction';
      description = this.exercise?.content || 'Jeux de rôles, où on pose des questions pour obtenir des informations sur une situation quotidienne';
    } else if (this.taskType === 'tache3') {
      title = 'Tâche 3 - Expression d\'un point de vue';
      description = this.exercise?.content || 'Présentation d\'un sujet, souvent lié à la vie quotidienne ou des débats de société';
    } else {
      title = 'TCF Expression Orale';
      description = 'Exercise TCF';
    }

    const exerciseData = {
      type: 'exercise_data',
      data: {
        title,
        description,
        content: this.exercise?.content || '',
      }
    };

    console.log('[Exercise] Envoi des données:', exerciseData.data);
    await this.sendDataMessage(this.context, exerciseData);
  }

  /**
   * Démarre le timer de préparation
   */
  private async startPreparationTimer(): Promise<void> {
    if (!this.context || this.timerState !== 'idle') return;

    this.timerState = 'preparation';
    const duration = this.config.durations.preparation;

    console.log(`[Timer] Démarrage du timer de préparation (${duration}s)`);
    
    await this.sendDataMessage(this.context, {
      type: 'start_preparation_timer',
      duration: duration,
      timestamp: Date.now()
    });

    // Programmer la fin automatique de la préparation
    this.preparationTimerTimeout = setTimeout(() => {
      this.onPreparationTimeExpired();
    }, duration * 1000);
  }

  /**
   * Appelé quand le temps de préparation est écoulé
   */
  private async onPreparationTimeExpired(): Promise<void> {
    if (this.timerState !== 'preparation' || !this.context) return;

    console.log('[Timer] Temps de préparation écoulé');
    
    await this.sendDataMessage(this.context, {
      type: 'end_preparation_timer'
    });

    this.timerState = 'idle';
    this.preparationTimerTimeout = null;
  }

  /**
   * Arrête le timer de préparation et démarre le timer d'examen
   */
  private async stopPreparationAndStartExam(): Promise<void> {
    if (!this.context) return;

    // Arrêter le timer de préparation si actif
    if (this.timerState === 'preparation' && this.preparationTimerTimeout) {
      console.log('[Timer] Préparation interrompue par entrée utilisateur');
      clearTimeout(this.preparationTimerTimeout);
      this.preparationTimerTimeout = null;

      await this.sendDataMessage(this.context, {
        type: 'end_preparation_timer'
      });
    }

    // Démarrer le timer d'examen
    await this.startExamTimer();
  }

  /**
   * Démarre le timer d'examen
   */
  private async startExamTimer(): Promise<void> {
    if (!this.context || this.timerState === 'exam' || this.timerState === 'finished') return;

    this.timerState = 'exam';
    const duration = this.config.durations.exam;

    console.log(`[Timer] Démarrage du timer d'examen (${duration}s)`);
    
    await this.sendDataMessage(this.context, {
      type: 'start_exam_timer',
      duration: duration,
      timestamp: Date.now()
    });

    // Programmer la fin automatique de l'examen
    this.examTimerTimeout = setTimeout(() => {
      this.onExamTimeExpired();
    }, duration * 1000);
  }

  /**
   * Appelé quand le temps d'examen est écoulé
   */
  private async onExamTimeExpired(): Promise<void> {
    if (this.timerState !== 'exam' || !this.context) return;

    console.log('[Timer] Temps d\'examen écoulé');
    
    await this.sendDataMessage(this.context, {
      type: 'end_exam_timer'
    });

    this.timerState = 'finished';
    this.examTimerTimeout = null;
  }

  /**
   * Initialise l'écoute des événements utilisateur pour gérer les timers
   * @param ctx Le contexte de la job LiveKit
   */
  initializeExamTimer(): void {
    // Écouter les entrées utilisateur pour gérer les transitions de timer
    this.session.on(voice.AgentSessionEventTypes.UserInputTranscribed, async () => {
      // Si on est en préparation, l'entrée utilisateur arrête la préparation et démarre l'examen
      if (this.timerState === 'preparation') {
        await this.stopPreparationAndStartExam();
      }
      // Si on est idle (pas de préparation), démarrer directement l'examen
      else if (this.timerState === 'idle' && this.config.durations.exam > 0) {
        await this.startExamTimer();
      }
    });
  }

  /**
   * Nettoie les timers en cours
   */
  cleanup(): void {
    if (this.preparationTimerTimeout) {
      clearTimeout(this.preparationTimerTimeout);
      this.preparationTimerTimeout = null;
    }
    if (this.examTimerTimeout) {
      clearTimeout(this.examTimerTimeout);
      this.examTimerTimeout = null;
    }
  }
}
