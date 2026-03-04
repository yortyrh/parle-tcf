import type { JobContext } from '@livekit/agents';
import { getTEFExercise } from '../exercises/tefExerciseLoader.js';
import { TCFAgent } from './TCFAgent.js';

/**
 * Agent TEF Canada - Section A (Demande d'informations)
 * L'IA joue le rôle du contact de l'annonce (vendeur, réceptionniste…).
 * Configuration chargée depuis config/agents/tef-section-a.yml
 */
export class TEFSectionA extends TCFAgent {
  private tefExerciseFilename: string;
  private tefSection: 'A';

  constructor(context: JobContext) {
    const exercise = getTEFExercise('A');
    console.log(`[TEF-A] Exercice sélectionné: ${exercise.id} - ${exercise.title}`);

    // Injecter l'annonce dans le format attendu par TCFAgent
    super(
      'tef-section-a',
      {
        id: exercise.id,
        taskType: 'Tâche 2', // satisfait le type TCFExercise
        content: `TITRE: ${exercise.title}\n\nANNONCE:\n${exercise.annonce}\n\nCONSIGNE DU CANDIDAT:\n${exercise.consigne}`,
        isImageBased: true,
        imagePath: exercise.filename,
      },
      context,
    );

    this.tefExerciseFilename = exercise.filename;
    this.tefSection = 'A';
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
