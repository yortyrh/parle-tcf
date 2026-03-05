import type { JobContext } from '@livekit/agents';
import { getTEFExercise } from '../exercises/tefExerciseLoader.js';
import { TCFAgent } from './TCFAgent.js';

/**
 * Agent TEF Canada - Section A (Demande d'informations)
 * L'IA joue le rôle du contact de l'annonce (vendeur, réceptionniste…).
 * Configuration chargée depuis config/agents/tef-section-a.yml
 */
export class TEFSectionA extends TCFAgent {
  private tefExercise: ReturnType<typeof getTEFExercise>;

  constructor(context: JobContext) {
    const exercise = getTEFExercise('A');
    console.log(`[TEF-A] Exercice sélectionné: ${exercise.id} - ${exercise.title}`);

    super(
      'tef-section-a',
      {
        id: exercise.id,
        taskType: 'Tâche 2',
        content: `TITRE: ${exercise.title}\n\nANNONCE:\n${exercise.annonce}\n\nCONSIGNE DU CANDIDAT:\n${exercise.consigne}`,
        consigne: exercise.consigne,
        isImageBased: true,
        imagePath: exercise.filename,
      },
      context,
    );

    this.tefExercise = exercise;
  }

  override async onEnter(): Promise<void> {
    // Envoyer les données de l'annonce au client web avant le greeting
    await this.sendDataMessage({
      type: 'exerciseImage',
      filename: this.tefExercise.filename,
      section: 'A' as const,
      annonce: this.tefExercise.annonce,
      title: this.tefExercise.title,
      consigne: this.tefExercise.consigne,
      generatedImagePath: this.tefExercise.generatedImagePath ?? null,
    });

    await super.onEnter();
  }
}
