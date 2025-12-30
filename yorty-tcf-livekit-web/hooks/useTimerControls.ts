import { useCallback, useEffect, useState } from 'react';
import { DataPacket_Kind, type RemoteParticipant } from 'livekit-client';
import { useRemoteParticipants } from '@livekit/components-react';

export interface TimerState {
  type: 'preparation' | 'exam' | null;
  isRunning: boolean;
  startTime: number | null;
  duration: number; // in seconds
}

export interface TimerControlMessage {
  type: 'start_preparation_timer' | 'end_preparation_timer' | 'start_exam_timer' | 'end_exam_timer';
  duration?: number; // Duration in seconds for start messages
  timestamp?: number;
}

/**
 * Hook to control a timer based on messages from the agent
 * Listens for timer control messages and manages timer state
 */
export function useTimerControls() {
  const [timerState, setTimerState] = useState<TimerState>({
    type: null,
    isRunning: false,
    startTime: null,
    duration: 0,
  });

  const remoteParticipants = useRemoteParticipants();

  const handleTimerMessage = useCallback((message: TimerControlMessage) => {
    const now = Date.now();

    console.log('[Timer] Message reçu:', message);

    switch (message.type) {
      case 'start_preparation_timer':
        setTimerState({
          type: 'preparation',
          isRunning: true,
          startTime: message.timestamp || now,
          duration: message.duration || 60, // Default 60 seconds
        });
        console.log(`[Timer] Timer de préparation démarré: ${message.duration}s`);
        break;

      case 'end_preparation_timer':
        setTimerState((prev) => ({
          ...prev,
          isRunning: false,
        }));
        console.log('[Timer] Timer de préparation arrêté');
        break;

      case 'start_exam_timer':
        setTimerState({
          type: 'exam',
          isRunning: true,
          startTime: message.timestamp || now,
          duration: message.duration || 120, // Default 120 seconds (2 minutes)
        });
        console.log(`[Timer] Timer d'examen démarré: ${message.duration}s`);
        break;

      case 'end_exam_timer':
        setTimerState({
          type: null,
          isRunning: false,
          startTime: null,
          duration: 0,
        });
        console.log("[Timer] Timer d'examen arrêté");
        break;

      default:
        console.warn('[Timer] Type de message inconnu:', message.type);
    }
  }, []);

  useEffect(() => {
    // Fonction pour gérer les données reçues
    const handleDataReceived = (
      payload: Uint8Array,
      participant: RemoteParticipant | undefined,
      kind: DataPacket_Kind
    ) => {
      // Décoder les données
      const decoder = new TextDecoder();
      const text = decoder.decode(payload);

      try {
        // Parser le JSON
        const data = JSON.parse(text);

        // Vérifier si c'est un message de contrôle du timer
        if (
          data.type &&
          [
            'start_preparation_timer',
            'end_preparation_timer',
            'start_exam_timer',
            'end_exam_timer',
          ].includes(data.type)
        ) {
          handleTimerMessage(data as TimerControlMessage);
        }
      } catch (error) {
        // Pas un message JSON ou pas un message de timer, ignorer
        console.debug('[Timer] Message non-JSON ignoré');
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
  }, [remoteParticipants, handleTimerMessage]);

  return {
    timerState,
    resetTimer: () =>
      setTimerState({
        type: null,
        isRunning: false,
        startTime: null,
        duration: 0,
      }),
  };
}
