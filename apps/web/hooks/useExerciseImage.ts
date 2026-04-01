import { useState } from 'react';
import type { ExerciseImageMessage } from '@yorty-tcf/shared';
import { useAgentDataMessage } from './useAgentDataMessage';

export interface ExerciseImageData {
  id: string | null;
  filename: string;
  section: 'A' | 'B';
  annonce: string | null;
  title: string | null;
  consigne: string | null;
  generatedImagePath: string | null;
  /** Map taille -> chemin (ex: {"1024x1536": "generated/TEF-A-01.jpg"}) */
  generatedImagePaths: Record<string, string> | null;
}

export function useExerciseImage() {
  const [imageData, setImageData] = useState<ExerciseImageData | null>(null);

  useAgentDataMessage<ExerciseImageMessage>('exerciseImage', (message) => {
    console.log('[ExerciseImage] Image reçue:', message.filename, 'section:', message.section);
    setImageData({
      id: message.id ?? null,
      filename: message.filename,
      section: message.section,
      annonce: message.annonce ?? null,
      title: message.title ?? null,
      consigne: message.consigne ?? null,
      generatedImagePath: message.generatedImagePath ?? null,
      generatedImagePaths: message.generatedImagePaths ?? null,
    });
  });

  return imageData;
}
