import { TCFAgent } from '@/agents/TCFAgent';
import type { Mode } from '@/config';
import { getRandomExercise } from '@/exercises/exerciseLoader';

/**
 * Agent pour TCF Tâche 3 - Expression d'Opinion
 * Configuration chargée depuis config/agents/tache3.yml
 * Sélectionne un exercice aléatoire depuis tcf-exercises.csv
 */
export class TCFTache3 extends TCFAgent {
  constructor() {
    const exercise = getRandomExercise('tache3');
    if (exercise) {
      console.log(`TCF Tâche 3 - Exercice sélectionné: ${exercise.id} - ${exercise.content.substring(0, 100)}...`);
    }
    super('tache3', exercise);
  }
}
