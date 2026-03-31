import { useState } from 'react';
import { useAgentDataMessage } from './useAgentDataMessage';

export interface ExerciseData {
  title: string;
  description: string;
  content?: string;
  exerciseId?: string;
  taskType?: string;
}

export interface ExerciseMessage {
  type: 'exercise_data';
  data: ExerciseData;
}

const TCF_TASK_TYPES = ['tache1', 'tache2', 'tache3'];

function syncExerciseUrl(taskType: string, exerciseId?: string): void {
  if (!TCF_TASK_TYPES.includes(taskType)) return;
  const segments = ['/tcf', taskType];
  if (exerciseId) segments.push(exerciseId);
  const newUrl = segments.join('/');
  if (typeof window === 'undefined' || window.location.pathname === newUrl) return;
  // The browser history entry for /tcf was added by router.push() in handleWelcomeStart,
  // so replaceState here simply refines the current entry with the exercise ID.
  window.history.replaceState(null, '', newUrl);
}

export function useExerciseData() {
  const [exerciseData, setExerciseData] = useState<ExerciseData | null>(null);

  useAgentDataMessage<ExerciseMessage>('exercise_data', (message) => {
    console.log('[Exercise] Données reçues:', message.data);
    setExerciseData(message.data);
    if (message.data.taskType) {
      syncExerciseUrl(message.data.taskType, message.data.exerciseId);
    }
  });

  return exerciseData;
}
