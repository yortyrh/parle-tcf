import * as React from 'react';
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
}

export const ChatEntry = ({
  name,
  locale,
  timestamp,
  message,
  messageOrigin,
  hasBeenEdited = false,
  className,
  ...props
}: ChatEntryProps) => {
  const time = new Date(timestamp);
  const title = time.toLocaleTimeString(locale, { timeStyle: 'full' });
  const isLocal = messageOrigin === 'local';

  return (
    <div
      title={title}
      data-lk-message-origin={messageOrigin}
      className={cn('mb-4 flex gap-2.5', isLocal ? 'flex-row-reverse' : '', className)}
      {...props}
    >
      {/* Avatar placeholder - could be added later */}
      <div
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          isLocal ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-700'
        )}
      >
        {isLocal ? 'V' : 'A'}
      </div>

      {/* Message content */}
      <div className={cn('grid', isLocal ? 'justify-items-end' : 'justify-items-start')}>
        {/* Sender name */}
        {name && (
          <h5
            className={cn(
              'pb-1 text-sm leading-snug font-semibold text-gray-900',
              isLocal && 'text-right'
            )}
          >
            {name}
          </h5>
        )}

        {/* Message bubble */}
        <div className="grid w-max max-w-md">
          <div
            className={cn(
              'inline-flex items-center gap-3 px-3.5 py-2',
              isLocal
                ? 'rounded-3xl rounded-tr-none bg-indigo-600'
                : 'rounded-3xl rounded-tl-none bg-gray-100'
            )}
          >
            <h5
              className={cn(
                'text-sm leading-snug font-normal',
                isLocal ? 'text-white' : 'text-gray-900'
              )}
            >
              {message}
            </h5>
          </div>

          {/* Timestamp */}
          <div
            className={cn(
              'inline-flex items-center py-1',
              isLocal ? 'justify-end pr-2' : 'justify-start pl-2'
            )}
          >
            <h6 className="text-xs leading-4 font-normal text-gray-500">
              {hasBeenEdited && '* '}
              {time.toLocaleTimeString(locale, { timeStyle: 'short' })}
            </h6>
          </div>
        </div>
      </div>
    </div>
  );
};
