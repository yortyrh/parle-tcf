import type { JobContext } from '@livekit/agents';
import { getExerciseById, getRandomExercise } from '../exercises/exerciseLoader.js';
import { TCFAgent } from './TCFAgent.js';

/**
 * Agent pour TCF Tâche 2 - Interaction
 * Configuration chargée depuis config/agents/tache2.yml
 * Sélectionne un exercice par ID si fourni, sinon aléatoire depuis tcf-exercises.csv
 */
export class TCFTache2 extends TCFAgent {
  constructor(context: JobContext, exerciseId?: string) {
    const exercise = exerciseId
      ? (getExerciseById(exerciseId) ?? getRandomExercise('tache2'))
      : getRandomExercise('tache2');
    if (exercise) {
      console.log(
        `TCF Tâche 2 - Exercice sélectionné: ${exercise.id} - ${exercise.content.substring(0, 100)}...`,
      );
    }
    super('tache2', exercise, context);
  }
}
