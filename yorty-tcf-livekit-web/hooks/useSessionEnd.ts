import { useState } from 'react';
import { useAgentDataMessage } from './useAgentDataMessage';

interface SessionEndMessage {
  type: 'session_end';
}

/**
 * Hook to detect end-of-session signal from the agent (`session_end` message).
 * Used to mute the candidate microphone before the report is generated.
 */
export function useSessionEnd() {
  const [sessionEnded, setSessionEnded] = useState(false);

  useAgentDataMessage<SessionEndMessage>('session_end', () => {
    console.log('[SessionEnd] Session ended by agent');
    setSessionEnded(true);
  });

  return sessionEnded;
}
