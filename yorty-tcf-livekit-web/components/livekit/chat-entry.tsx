import * as React from 'react';
import { BarVisualizer } from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';
import { Robot, User } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface ChatEntryProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The locale to use for the timestamp. */
  locale: string;
  /** The timestamp of the message. */
  timestamp: number;
  /** The message to display. */
  message: string;
  /** The origin of the message. */
  messageOrigin: 'local' | 'remote';
  /** The sender's name. */
  name?: string;
  /** Whether the message has been edited. */
  hasBeenEdited?: boolean;
  /** Agent state for visualizer */
  agentState?: string;
  /** Agent audio track for visualizer */
  agentAudioTrack?: TrackReferenceOrPlaceholder;
  /** Whether this is the last agent message */
  isLastAgentMessage?: boolean;
}

export const ChatEntry = ({
  name,
  locale,
  timestamp,
  message,
  messageOrigin,
  hasBeenEdited = false,
  agentState,
  agentAudioTrack,
  isLastAgentMessage = false,
  className,
  ...props
}: ChatEntryProps) => {
  const time = new Date(timestamp);
  const title = time.toLocaleTimeString(locale, { timeStyle: 'full' });
  const isLocal = messageOrigin === 'local';
  const isAgent = !isLocal;
  const showVisualizer = isAgent && isLastAgentMessage && (agentState === 'speaking' || agentState === 'listening');

  return (
    <div
      title={title}
      data-lk-message-origin={messageOrigin}
      className={cn(
        'mb-3 flex gap-2 sm:mb-4 sm:gap-2.5',
        isLocal ? 'flex-row-reverse' : '',
        className
      )}
      {...props}
    >
      {/* Avatar or Audio Visualizer */}
      {showVisualizer ? (
        <div className="flex-shrink-0">
          <div
            className={cn(
              'bg-background aspect-square rounded-sm border transition-all duration-500 px-1',
              'border-input/50 h-8 w-8 drop-shadow-lg sm:h-10 sm:w-10'
            )}
          >
            <BarVisualizer
              barCount={5}
              state={agentState}
              options={{ minHeight: 5 }}
              trackRef={agentAudioTrack}
              className={cn('flex h-full items-center justify-center gap-0.5 sm:gap-1')}
            >
              <span
                className={cn([
                  'bg-muted min-h-2 w-2 rounded-full sm:min-h-2.5 sm:w-2.5',
                  'origin-center transition-colors duration-250 ease-linear',
                  'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted',
                ])}
              />
            </BarVisualizer>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-10 sm:w-10 sm:text-sm',
            isLocal ? 'bg-cyan-700 text-white' : 'bg-teal-600 text-white'
          )}
        >
          {isLocal ? (
            <User weight="bold" className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <Robot weight="bold" className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </div>
      )}

      {/* Message content */}
      <div
        className={cn('grid min-w-0 flex-1', isLocal ? 'justify-items-end' : 'justify-items-start')}
      >
        {/* Sender name */}
        {name && (
          <h5
            className={cn(
              'pb-0.5 text-xs leading-snug font-semibold text-gray-900 sm:pb-1 sm:text-sm',
              isLocal && 'text-right'
            )}
          >
            {name}
          </h5>
        )}

        {/* Message bubble */}
        <div className="grid w-auto max-w-[85%] sm:max-w-md">
          <div
            className={cn(
              'inline-flex items-center gap-2 px-2.5 py-1.5 sm:gap-3 sm:px-3.5 sm:py-2',
              isLocal
                ? 'rounded-2xl rounded-tr-none bg-cyan-700 sm:rounded-3xl'
                : 'rounded-2xl rounded-tl-none bg-gray-100 sm:rounded-3xl'
            )}
          >
            <h5
              className={cn(
                'text-xs leading-snug font-normal break-words sm:text-sm',
                isLocal ? 'text-white' : 'text-gray-900'
              )}
            >
              {message}
            </h5>
          </div>

          {/* Timestamp */}
          <div
            className={cn(
              'inline-flex items-center py-0.5 sm:py-1',
              isLocal ? 'justify-end pr-1.5 sm:pr-2' : 'justify-start pl-1.5 sm:pl-2'
            )}
          >
            <h6 className="text-[10px] leading-4 font-normal text-gray-500 sm:text-xs">
              {hasBeenEdited && '* '}
              {time.toLocaleTimeString(locale, { timeStyle: 'short' })}
            </h6>
          </div>
        </div>
      </div>
    </div>
  );
};
