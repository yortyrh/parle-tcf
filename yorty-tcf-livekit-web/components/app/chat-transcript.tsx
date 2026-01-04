'use client';

import { type ReceivedMessage, useVoiceAssistant } from '@livekit/components-react';
import { ChatEntry } from '@/components/livekit/chat-entry';

interface ChatTranscriptProps {
  hidden?: boolean;
  messages?: ReceivedMessage[];
  className?: string;
}

export function ChatTranscript({ hidden = false, messages = [], className }: ChatTranscriptProps) {
  const { state: agentState, audioTrack: agentAudioTrack } = useVoiceAssistant();
  
  if (hidden) return null;

  // Find the index of the last agent message
  const lastAgentMessageIndex = messages.reduce((lastIndex, msg, currentIndex) => {
    const isAgentMessage = !msg.from?.isLocal;
    return isAgentMessage ? currentIndex : lastIndex;
  }, -1);

  return (
    <div className={className}>
      {messages.map((receivedMessage, index) => {
        const { id, timestamp, from, message } = receivedMessage;
        const locale = navigator?.language ?? 'fr-FR';
        const messageOrigin = from?.isLocal ? 'local' : 'remote';
        const hasBeenEdited =
          receivedMessage.type === 'chatMessage' && !!receivedMessage.editTimestamp;
        const isLastAgentMessage = index === lastAgentMessageIndex;

        return (
          <ChatEntry
            key={id}
            locale={locale}
            timestamp={timestamp}
            message={message}
            messageOrigin={messageOrigin}
            name={messageOrigin === 'local' ? 'Vous' : 'Agent TCF'}
            hasBeenEdited={hasBeenEdited}
            agentState={agentState}
            agentAudioTrack={agentAudioTrack}
            isLastAgentMessage={isLastAgentMessage}
          />
        );
      })}
    </div>
  );
}
