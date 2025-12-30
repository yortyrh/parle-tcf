/**
 * Contrôleur de timer pour les exercices TCF
 * Utilise la méthode sendDataMessage de TCFAgent pour envoyer les commandes
 */

import type { JobContext } from '@livekit/agents';
import type { TCFAgent } from './TCFAgent.js';

export interface TimerControlMessage {
  type: 'start_preparation_timer' | 'end_preparation_timer' | 'start_exam_timer' | 'end_exam_timer';
  duration?: number; // Duration in seconds
  timestamp?: number; // Timestamp in milliseconds
}

/**
 * Durées recommandées pour chaque tâche TCF (en secondes)
 */
export const TCF_DURATIONS = {
  TACHE_1: {
    preparation: 0, // Pas de préparation
    exam: 120, // 2 minutes
  },
  TACHE_2: {
    preparation: 120, // 2 minutes
    exam: 180, // 3 minutes (peut aller jusqu'à 4)
  },
  TACHE_3: {
    preparation: 180, // 3 minutes
    exam: 240, // 4 minutes (peut aller jusqu'à 5)
  },
} as const;

/**
 * Contrôleur de timer pour les exercices TCF
 */
export class TimerController {
  constructor(
    private context: JobContext,
    private agent: TCFAgent
  ) {}

  /**
   * Envoie un message de contrôle du timer
   */
  private async sendTimerControl(message: TimerControlMessage): Promise<void> {
    try {
      await this.agent.sendDataMessage(this.context, message);
      console.log('[Timer] Message envoyé:', message.type, message.duration ? `(${message.duration}s)` : '');
    } catch (error) {
      console.error('[Timer] Erreur lors de l\'envoi du message:', error);
    }
  }

  /**
   * Démarre le timer de préparation
   * @param duration Durée en secondes (défaut: 60)
   */
  async startPreparationTimer(duration: number = 60): Promise<void> {
    await this.sendTimerControl({
      type: 'start_preparation_timer',
      duration,
      timestamp: Date.now(),
    });
  }

  /**
   * Arrête le timer de préparation
   */
  async endPreparationTimer(): Promise<void> {
    await this.sendTimerControl({
      type: 'end_preparation_timer',
    });
  }

  /**
   * Démarre le timer d'examen
   * @param duration Durée en secondes (défaut: 120)
   */
  async startExamTimer(duration: number = 120): Promise<void> {
    await this.sendTimerControl({
      type: 'start_exam_timer',
      duration,
      timestamp: Date.now(),
    });
  }

  /**
   * Arrête le timer d'examen
   */
  async endExamTimer(): Promise<void> {
    await this.sendTimerControl({
      type: 'end_exam_timer',
    });
  }

  /**
   * Attend pendant une durée spécifiée
   * @param milliseconds Durée en millisecondes
   */
  private async delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  /**
   * Exécute une phase de préparation complète
   * @param duration Durée en secondes
   */
  async runPreparationPhase(duration: number): Promise<void> {
    console.log(`[Timer] Début de la préparation (${duration}s)`);
    await this.startPreparationTimer(duration);
    await this.delay(duration * 1000);
    await this.endPreparationTimer();
    console.log('[Timer] Fin de la préparation');
  }

  /**
   * Exécute une phase d'examen complète
   * @param duration Durée en secondes
   */
  async runExamPhase(duration: number): Promise<void> {
    console.log(`[Timer] Début de l'examen (${duration}s)`);
    await this.startExamTimer(duration);
    await this.delay(duration * 1000);
    await this.endExamTimer();
    console.log('[Timer] Fin de l\'examen');
  }

  /**
   * Exécute une phase d'examen avec avertissements vocaux
   * @param duration Durée totale en secondes
   * @param onWarning Callback appelé pour les avertissements (temps restant en secondes)
   */
  async runExamPhaseWithWarnings(
    duration: number,
    onWarning?: (timeLeft: number) => Promise<void>
  ): Promise<void> {
    console.log(`[Timer] Début de l'examen avec avertissements (${duration}s)`);
    await this.startExamTimer(duration);

    // Calcul des points d'avertissement
    const warnings: number[] = [];
    
    // Avertissement à mi-parcours si > 2 minutes
    if (duration >= 120) {
      warnings.push(Math.floor(duration / 2));
    }
    
    // Avertissement à 1 minute
    if (duration > 60) {
      warnings.push(60);
    }
    
    // Avertissement à 30 secondes
    if (duration > 30) {
      warnings.push(30);
    }

    // Trier par ordre décroissant
    warnings.sort((a, b) => b - a);

    let elapsed = 0;
    const interval = 1000; // Vérifier chaque seconde

    for (const warning of warnings) {
      const timeUntilWarning = (duration - warning) * 1000 - elapsed;
      if (timeUntilWarning > 0) {
        await this.delay(timeUntilWarning);
        elapsed += timeUntilWarning;
        
        if (onWarning) {
          await onWarning(warning);
        }
      }
    }

    // Attendre le temps restant
    const remaining = duration * 1000 - elapsed;
    if (remaining > 0) {
      await this.delay(remaining);
    }

    await this.endExamTimer();
    console.log('[Timer] Fin de l\'examen');
  }
}

