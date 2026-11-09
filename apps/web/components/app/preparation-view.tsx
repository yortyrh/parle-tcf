'use client';

import { Button } from '@/components/ui/button';

interface PreparationViewProps {
  secondsLeft: number;
  exerciseText: string;
  onSkip: () => void;
}

/**
 * Tâche 2 gives two minutes to read the situation before speaking. The voice
 * session only starts afterwards (or when the candidate says they are ready).
 */
export function PreparationView({ secondsLeft, exerciseText, onSkip }: PreparationViewProps) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return (
    <section className="flex h-full w-full items-center justify-center p-3 sm:p-6">
      <div className="bg-card flex w-full max-w-2xl flex-col gap-4 rounded-2xl border p-5 shadow-lg sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Préparation</h1>
          <span
            role="timer"
            aria-label="Temps de préparation restant"
            className="text-primary font-mono text-2xl font-bold tabular-nums"
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          Lisez la situation et préparez vos questions. L&apos;examinateur vous répondra dès que la
          préparation sera terminée.
        </p>
        <blockquote className="border-primary/40 bg-primary/5 rounded-lg border-l-4 p-4 text-base leading-relaxed">
          {exerciseText}
        </blockquote>
        <Button variant="primary" size="lg" onClick={onSkip} className="self-end">
          Je suis prêt(e)
        </Button>
      </div>
    </section>
  );
}
