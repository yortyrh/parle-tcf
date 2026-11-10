'use client';

import { cn } from '@/lib/utils';

interface TimerDisplayProps {
  /** Seconds left on the official speaking time. */
  remainingSeconds: number;
  className?: string;
  compact?: boolean;
}

/**
 * Displays the time left as MM:SS (counting down). Turns red in the last
 * 30 seconds so the candidate can wrap up.
 */
export function TimerDisplay({ remainingSeconds, className, compact }: TimerDisplayProps) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const urgent = remainingSeconds <= 30;

  return (
    <div
      role="timer"
      aria-label="Temps restant"
      className={cn(
        'bg-card flex items-center rounded-lg border',
        compact ? 'border px-2 py-1 sm:px-2.5 sm:py-1.5' : 'px-4 py-2.5 sm:px-5 sm:py-3',
        urgent ? 'border-destructive/40 bg-destructive/10' : 'border-primary/30 bg-primary/10',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {!compact && (
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider sm:text-xs">
            Temps restant
          </span>
        )}
        <span
          className={cn(
            'font-mono font-bold tabular-nums',
            urgent ? 'text-destructive' : 'text-primary',
            compact ? 'text-base sm:text-lg' : 'text-2xl sm:text-3xl'
          )}
        >
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
