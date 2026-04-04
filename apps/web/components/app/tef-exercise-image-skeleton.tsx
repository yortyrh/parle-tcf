'use client';

import { cn } from '@/lib/utils';

export interface TefExerciseImageSkeletonProps {
  className?: string;
  /** Libellé lu par les lecteurs d’écran (connexion vs image). */
  ariaLabel?: string;
}

/**
 * Placeholder TEF — même structure que {@link ExerciseImageViewer} pour une transition
 * fluide : document centré (affiche ~4:5), sans carte interne, barre d’outils zoom à droite.
 */
export function TefExerciseImageSkeleton({
  className,
  ariaLabel = 'Chargement de l’image de l’exercice',
}: TefExerciseImageSkeletonProps) {
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col', className)}
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className="bg-card relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-none border-0 pt-4 shadow-md ring-1 ring-black/5">
        <div
          className="absolute top-6 right-2 z-10 flex flex-col gap-1.5 sm:top-8 sm:right-3"
          aria-hidden
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="border-border/80 bg-background/80 size-10 rounded-full border shadow-sm"
            />
          ))}
        </div>

        <div className="flex h-full min-h-[200px] w-full justify-center px-2 pb-3 sm:px-3">
          <div
            className={cn(
              'relative w-full max-w-[min(100%,34rem)]',
              'animate-pulse',
              'aspect-[4/5] max-h-[min(72vh,640px)] self-start'
            )}
          >
            <div
              className={cn(
                'absolute inset-0 rounded-[3px]',
                'from-muted/30 via-muted/50 to-muted/35 bg-gradient-to-b'
              )}
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-[5%] flex flex-col items-center gap-2 px-8 sm:top-[6%]"
              aria-hidden
            >
              <div className="bg-foreground/[0.07] h-2.5 w-[78%] max-w-[16rem] rounded-sm" />
              <div className="bg-foreground/[0.06] h-2 w-[52%] max-w-[11rem] rounded-sm" />
            </div>
            <div
              className="pointer-events-none absolute inset-x-[10%] bottom-[8%] flex flex-col gap-2 sm:inset-x-[12%]"
              aria-hidden
            >
              <div className="bg-foreground/[0.055] h-2 w-full rounded-sm" />
              <div className="bg-foreground/[0.05] h-2 w-[92%] rounded-sm" />
              <div className="bg-foreground/[0.045] h-2 w-[88%] rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
