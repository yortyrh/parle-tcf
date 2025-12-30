'use client';

import { useEffect, useState } from 'react';
import type { TimerState } from '@/hooks/useTimerControls';
import { cn } from '@/lib/utils';

interface TimerDisplayProps {
  timerState: TimerState;
  className?: string;
}

/**
 * Timer display component that shows countdown or elapsed time
 */
export function TimerDisplay({ timerState, className }: TimerDisplayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!timerState.isRunning || !timerState.startTime) {
      return;
    }

    // Update timer every 100ms for smooth display
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - timerState.startTime!) / 1000);
      setElapsedSeconds(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [timerState.isRunning, timerState.startTime]);

  // Don't render if timer is not active
  if (!timerState.type || !timerState.isRunning) {
    return null;
  }

  // Calculate remaining time
  const remainingSeconds = Math.max(0, timerState.duration - elapsedSeconds);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  // Determine if timer is in warning state (less than 30 seconds remaining)
  const isWarning = remainingSeconds <= 30 && remainingSeconds > 10;
  const isDanger = remainingSeconds <= 10;

  // Get timer label
  const label = timerState.type === 'preparation' ? 'Préparation' : 'Examen';

  return (
    <div
      className={cn(
        'flex flex-col items-end gap-1.5 rounded-lg border-2 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-300 sm:gap-2 sm:px-5 sm:py-3',
        isDanger && 'animate-pulse border-red-500 bg-red-50',
        isWarning && !isDanger && 'border-orange-400 bg-orange-50',
        !isWarning && !isDanger && 'border-primary/30 bg-primary/5',
        className
      )}
    >
      <span className="text-[10px] font-medium tracking-wider text-gray-500 uppercase sm:text-xs">
        {label}
      </span>
      <div
        className={cn(
          'font-mono text-2xl font-bold tabular-nums transition-colors sm:text-3xl',
          isDanger && 'text-red-600',
          isWarning && !isDanger && 'text-orange-600',
          !isWarning && !isDanger && 'text-primary'
        )}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      {isDanger && (
        <span className="text-[10px] font-semibold text-red-600 sm:text-xs">Temps écoulé!</span>
      )}
    </div>
  );
}
