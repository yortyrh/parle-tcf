'use client';

import { cn } from '@/lib/utils';

interface TimerDisplayProps {
  elapsedSeconds: number;
  className?: string;
  compact?: boolean;
}

/**
 * Displays session elapsed time as MM:SS (counting up).
 */
export function TimerDisplay({ elapsedSeconds, className, compact }: TimerDisplayProps) {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return (
    <div
      className={cn(
        'flex items-center rounded-lg border bg-white/90 shadow-md backdrop-blur',
        compact ? 'border px-2 py-1 sm:px-2.5 sm:py-1.5' : 'px-4 py-2.5 sm:px-5 sm:py-3',
        'border-primary/30 bg-primary/10',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {!compact && (
          <span className="text-[10px] font-medium tracking-wider text-gray-500 uppercase sm:text-xs">
            Session
          </span>
        )}
        <span
          className={cn(
            'text-primary font-mono font-bold tabular-nums',
            compact ? 'text-base sm:text-lg' : 'text-2xl sm:text-3xl'
          )}
        >
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
