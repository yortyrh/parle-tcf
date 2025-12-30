import { useCallback, useEffect, useState } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';

export interface ExerciseData {
  title: string;
  description: string;
  content?: string;
}

export interface ExerciseMessage {
  type: 'exercise_data';
  data: ExerciseData;
}

/**
 * Hook pour recevoir les données de l'exercice depuis l'agent
 */
export function useExerciseData() {
  const [exerciseData, setExerciseData] = useState<ExerciseData | null>(null);
  const remoteParticipants = useRemoteParticipants();

  const handleExerciseMessage = useCallback((message: ExerciseMessage) => {
    console.log('[Exercise] Données reçues:', message.data);
    setExerciseData(message.data);
  }, []);

  useEffect(() => {
    // Fonction pour gérer les données reçues
    const handleDataReceived = (payload: Uint8Array) => {
      // Décoder les données
      const decoder = new TextDecoder();
      const text = decoder.decode(payload);

      try {
        // Parser le JSON
        const data = JSON.parse(text);

        // Vérifier si c'est un message d'exercice
        if (data.type === 'exercise_data') {
          handleExerciseMessage(data as ExerciseMessage);
        }
      } catch {
        // Pas un message JSON ou pas un message d'exercice, ignorer
        console.debug('[Exercise] Message non-JSON ignoré');
      }
    };

    // S'abonner aux événements de données de tous les participants distants
    const unsubscribeFns: Array<() => void> = [];

    remoteParticipants.forEach((participant) => {
      // Écouter les événements de données
      participant.on('dataReceived', handleDataReceived);

      // Ajouter la fonction de désabonnement
      unsubscribeFns.push(() => {
        participant.off('dataReceived', handleDataReceived);
      });
    });

    // Nettoyer les abonnements lors du démontage
    return () => {
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
    };
  }, [remoteParticipants, handleExerciseMessage]);

  return exerciseData;
}
