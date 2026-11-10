'use client';

import { SESSION_PHASE_LABELS, type SessionPhase } from '@/lib/session-phase';
import { cn } from '@/lib/utils';

const TONE: Record<SessionPhase, string> = {
  preparing: 'bg-highlight-soft text-foreground',
  connecting: 'bg-muted text-muted-foreground',
  idle: 'bg-muted text-muted-foreground',
  ended: 'bg-muted text-foreground',
  'examiner-speaking': 'bg-primary/10 text-primary',
  muted: 'bg-destructive/10 text-destructive',
  'candidate-speaking': 'bg-success/15 text-success',
  listening: 'bg-success/10 text-success',
};

/** Who has the floor, in words (announced politely to screen readers). */
export function SessionStatus({ phase, className }: { phase: SessionPhase; className?: string }) {
  const live =
    phase === 'examiner-speaking' || phase === 'candidate-speaking' || phase === 'listening';
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
        TONE[phase],
        className
      )}
    >
      <span aria-hidden className={cn('size-2 rounded-full bg-current', live && 'animate-pulse')} />
      {SESSION_PHASE_LABELS[phase]}
    </span>
  );
}
