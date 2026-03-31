import type { JobContext } from '@livekit/agents';
import { getExerciseById, getRandomExercise } from '../exercises/exerciseLoader.js';
import { TCFAgent } from './TCFAgent.js';

/**
 * Agent pour TCF Tâche 3 - Expression d'Opinion
 * Configuration chargée depuis config/agents/tache3.yml
 * Sélectionne un exercice par ID si fourni, sinon aléatoire depuis tcf-exercises.csv
 */
export class TCFTache3 extends TCFAgent {
  constructor(context: JobContext, exerciseId?: string) {
    const exercise = exerciseId
      ? (getExerciseById(exerciseId) ?? getRandomExercise('tache3'))
      : getRandomExercise('tache3');
    if (exercise) {
      console.log(
        `TCF Tâche 3 - Exercice sélectionné: ${exercise.id} - ${exercise.content.substring(0, 100)}...`,
      );
    }
    super('tache3', exercise, context);
  }
}
