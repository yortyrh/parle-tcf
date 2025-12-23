import { TCFAgent } from '@/agents/TCFAgent';
import { getRandomExercise } from '@/exercises/exerciseLoader';

/**
 * Agent pour TCF Tâche 2 - Interaction
 * Configuration chargée depuis config/agents/tache2.yml
 * Sélectionne un exercice aléatoire depuis tcf-exercises.csv
 */
export class TCFTache2 extends TCFAgent {
  constructor() {
    const exercise = getRandomExercise('tache2');
    if (exercise) {
      console.log(`TCF Tâche 2 - Exercice sélectionné: ${exercise.id} - ${exercise.content.substring(0, 100)}...`);
    }
    super('tache2', exercise);
  }
}

