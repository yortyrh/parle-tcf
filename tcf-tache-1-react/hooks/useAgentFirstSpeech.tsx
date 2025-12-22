import { useEffect, useState } from 'react';
import { useSessionContext, useSessionMessages } from '@livekit/components-react';

/**
 * Hook to detect when the agent has finished speaking for the first time
 * @returns {boolean} agentHasSpoken - true if the agent has finished their first message
 */
export function useAgentFirstSpeech(): boolean {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [agentHasSpoken, setAgentHasSpoken] = useState(false);

  useEffect(() => {
    if (agentHasSpoken) {
      return; // Already detected, no need to check further
    }

    // Check if there's at least one message from the agent (non-local message)
    const hasAgentMessage = messages.some((message) => message.from?.isLocal === false);

    if (hasAgentMessage) {
      setAgentHasSpoken(true);
    }
  }, [messages, agentHasSpoken]);

  return agentHasSpoken;
}

