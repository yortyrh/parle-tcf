import type { JobContext } from '@livekit/agents';
import { getTEFExercise } from '../exercises/tefExerciseLoader.js';
import { TCFAgent } from './TCFAgent.js';

/**
 * Agent TEF Canada - Section B (Argumentation et conviction)
 * L'IA joue le rôle de l'ami(e) hésitant(e) du candidat.
 * Configuration chargée depuis config/agents/tef-section-b.yml
 */
export class TEFSectionB extends TCFAgent {
  private tefExercise: ReturnType<typeof getTEFExercise>;

  constructor(context: JobContext) {
    const exercise = getTEFExercise('B');
    console.log(`[TEF-B] Exercice sélectionné: ${exercise.id} - ${exercise.title}`);

    super(
      'tef-section-b',
      {
        id: exercise.id,
        taskType: 'Tâche 3',
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
      id: this.tefExercise.id,
      filename: this.tefExercise.filename,
      section: 'B' as const,
      annonce: this.tefExercise.annonce,
      title: this.tefExercise.title,
      consigne: this.tefExercise.consigne,
      generatedImagePath: this.tefExercise.generatedImagePath ?? null,
    });

    await super.onEnter();
  }
}
