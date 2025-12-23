'use client';

import { type ReceivedMessage } from '@livekit/components-react';
import { ChatEntry } from '@/components/livekit/chat-entry';

interface ChatTranscriptProps {
  hidden?: boolean;
  messages?: ReceivedMessage[];
  className?: string;
}

export function ChatTranscript({ hidden = false, messages = [], className }: ChatTranscriptProps) {
  if (hidden) return null;

  return (
    <div className={className}>
      {messages.map((receivedMessage) => {
        const { id, timestamp, from, message } = receivedMessage;
        const locale = navigator?.language ?? 'fr-FR';
        const messageOrigin = from?.isLocal ? 'local' : 'remote';
        const hasBeenEdited =
          receivedMessage.type === 'chatMessage' && !!receivedMessage.editTimestamp;

        return (
          <ChatEntry
            key={id}
            locale={locale}
            timestamp={timestamp}
            message={message}
            messageOrigin={messageOrigin}
            name={messageOrigin === 'local' ? 'Vous' : 'Agent TCF'}
            hasBeenEdited={hasBeenEdited}
          />
        );
      })}
    </div>
  );
}
