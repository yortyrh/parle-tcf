import { useState } from 'react';
import { useAgentDataMessage } from './useAgentDataMessage';

export interface ExerciseData {
  title: string;
  description: string;
  content?: string;
}

export interface ExerciseMessage {
  type: 'exercise_data';
  data: ExerciseData;
}

export function useExerciseData() {
  const [exerciseData, setExerciseData] = useState<ExerciseData | null>(null);

  useAgentDataMessage<ExerciseMessage>('exercise_data', (message) => {
    console.log('[Exercise] Données reçues:', message.data);
    setExerciseData(message.data);
  });

  return exerciseData;
}
