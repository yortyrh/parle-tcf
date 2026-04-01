import { useCallback, useState } from 'react';
import type { SessionEndMessage, SessionRestartMessage } from '@yorty-tcf/shared';
import { useAgentDataMessage } from './useAgentDataMessage';

/**
 * Hook to detect end-of-session signal from the agent (`session_end` message).
 * Supports reset via `session_restart` from the agent or manual `resetSessionEnd()`.
 */
export function useSessionEnd() {
  const [sessionEnded, setSessionEnded] = useState(false);

  useAgentDataMessage<SessionEndMessage>('session_end', () => {
    console.log('[SessionEnd] Session ended by agent');
    setSessionEnded(true);
  });

  useAgentDataMessage<SessionRestartMessage>('session_restart', () => {
    console.log('[SessionEnd] Session restarted by agent');
    setSessionEnded(false);
  });

  const resetSessionEnd = useCallback(() => setSessionEnded(false), []);

  return { sessionEnded, resetSessionEnd };
}
