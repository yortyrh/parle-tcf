import type { JobContext } from '@livekit/agents';
import { getTEFExercise } from '../exercises/tefExerciseLoader.js';
import { TCFAgent } from './TCFAgent.js';

/**
 * Agent TEF Canada - Section B (Argumentation et conviction)
 * L'IA joue le rôle de l'ami(e) hésitant(e) du candidat.
 * Configuration chargée depuis config/agents/tef-section-b.yml
 */
export class TEFSectionB extends TCFAgent {
  private tefExerciseFilename: string;
  private tefSection: 'B';

  constructor(context: JobContext) {
    const exercise = getTEFExercise('B');
    console.log(`[TEF-B] Exercice sélectionné: ${exercise.id} - ${exercise.title}`);

    // Injecter l'annonce dans le format attendu par TCFAgent
    super(
      'tef-section-b',
      {
        id: exercise.id,
        taskType: 'Tâche 3', // satisfait le type TCFExercise
        content: `TITRE: ${exercise.title}\n\nANNONCE:\n${exercise.annonce}\n\nCONSIGNE DU CANDIDAT:\n${exercise.consigne}`,
        isImageBased: true,
        imagePath: exercise.filename,
      },
      context,
    );

    this.tefExerciseFilename = exercise.filename;
    this.tefSection = 'B';
  }

  override async onEnter(): Promise<void> {
    // Envoyer l'image au client web avant le greeting
    await this.sendDataMessage({
      type: 'exerciseImage',
      filename: this.tefExerciseFilename,
      section: this.tefSection,
    });

    await super.onEnter();
  }
}
