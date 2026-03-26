import { useCallback, useEffect, useState } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';

/**
 * Hook to detect end-of-session signal from the agent (`session_end` message).
 * Used to mute the candidate microphone before the report is generated.
 */
export function useSessionEnd() {
  const [sessionEnded, setSessionEnded] = useState(false);
  const remoteParticipants = useRemoteParticipants();

  const handleSessionEnd = useCallback(() => {
    console.log('[SessionEnd] Session ended by agent');
    setSessionEnded(true);
  }, []);

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const text = decoder.decode(payload);

      try {
        const data = JSON.parse(text);
        if (data.type === 'session_end') {
          handleSessionEnd();
        }
      } catch {
        // Not a JSON message, ignore
      }
    };

    const unsubscribeFns: Array<() => void> = [];

    remoteParticipants.forEach((participant) => {
      participant.on('dataReceived', handleDataReceived);
      unsubscribeFns.push(() => {
        participant.off('dataReceived', handleDataReceived);
      });
    });

    return () => {
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
    };
  }, [remoteParticipants, handleSessionEnd]);

  return sessionEnded;
}
