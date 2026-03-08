import { useCallback, useEffect, useState } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';

export interface ExerciseImageData {
  id: string | null;
  filename: string;
  section: 'A' | 'B';
  annonce: string | null;
  title: string | null;
  consigne: string | null;
  generatedImagePath: string | null;
}

export interface ExerciseImageMessage {
  type: 'exerciseImage';
  id?: string;
  filename: string;
  section: 'A' | 'B';
  annonce?: string;
  title?: string;
  consigne?: string;
  generatedImagePath?: string | null;
}

/**
 * Hook pour recevoir les données d'image d'exercice TEF depuis l'agent
 */
export function useExerciseImage() {
  const [imageData, setImageData] = useState<ExerciseImageData | null>(null);
  const remoteParticipants = useRemoteParticipants();

  const handleMessage = useCallback((message: ExerciseImageMessage) => {
    console.log('[ExerciseImage] Image reçue:', message.filename, 'section:', message.section);
    setImageData({
      id: message.id ?? null,
      filename: message.filename,
      section: message.section,
      annonce: message.annonce ?? null,
      title: message.title ?? null,
      consigne: message.consigne ?? null,
      generatedImagePath: message.generatedImagePath ?? null,
    });
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
