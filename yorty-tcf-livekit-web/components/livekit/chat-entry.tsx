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
      className={cn(
        'mb-3 flex gap-2 sm:mb-4 sm:gap-2.5',
        isLocal ? 'flex-row-reverse' : '',
        className
      )}
      {...props}
    >
      {/* Avatar placeholder - could be added later */}
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-10 sm:w-10 sm:text-sm',
          isLocal ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-700'
        )}
      >
        {isLocal ? 'V' : 'A'}
      </div>

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
                ? 'rounded-2xl rounded-tr-none bg-indigo-600 sm:rounded-3xl'
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
