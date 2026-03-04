import { useCallback, useEffect, useState } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';

export interface ExerciseImageData {
  filename: string;
  section: 'A' | 'B';
}

export interface ExerciseImageMessage {
  type: 'exerciseImage';
  filename: string;
  section: 'A' | 'B';
}

/**
 * Hook pour recevoir les données d'image d'exercice TEF depuis l'agent
 */
export function useExerciseImage() {
  const [imageData, setImageData] = useState<ExerciseImageData | null>(null);
  const remoteParticipants = useRemoteParticipants();

  const handleMessage = useCallback((message: ExerciseImageMessage) => {
    console.log('[ExerciseImage] Image reçue:', message.filename, 'section:', message.section);
    setImageData({ filename: message.filename, section: message.section });
  }, []);

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const text = decoder.decode(payload);
      try {
        const data = JSON.parse(text);
        if (data.type === 'exerciseImage') {
          handleMessage(data as ExerciseImageMessage);
        }
      } catch {
        // not a JSON message, ignore
      }
    };

    const unsubscribeFns: Array<() => void> = [];
    remoteParticipants.forEach((participant) => {
      participant.on('dataReceived', handleDataReceived);
      unsubscribeFns.push(() => participant.off('dataReceived', handleDataReceived));
    });

    return () => {
      unsubscribeFns.forEach((fn) => fn());
    };
  }, [remoteParticipants, handleMessage]);

  return imageData;
}
