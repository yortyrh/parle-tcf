'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TASK_DURATIONS, type TaskType } from '@parle-tcf/shared';
import type { Task } from '@/app-config';
import { AppHeader } from '@/components/app/app-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`;
}

const TIMINGS = Object.fromEntries(
  (Object.keys(TASK_DURATIONS) as TaskType[]).map((t) => {
    const { preparationS, speakingS } = TASK_DURATIONS[t];
    return [
      t,
      preparationS > 0
        ? `${formatMinutes(preparationS)} de préparation + ${formatMinutes(speakingS)}`
        : formatMinutes(speakingS),
    ];
  })
) as Record<TaskType, string>;

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: (taskType: string) => void;
  tasks: Task[];
  homeHref?: string;
  /** Pré-sélection (ex. slug `/tcf/tache2`) pour activer « Commencer » sans re-cliquer la carte. */
  initialSelectedTaskType?: string | null;
}

export function WelcomeView({
  startButtonText,
  onStartCall,
  tasks,
  homeHref,
  initialSelectedTaskType = null,
}: WelcomeViewProps) {
  const [selectedTaskType, setSelectedTaskType] = useState<string | null>(() => {
    if (initialSelectedTaskType && tasks.some((t) => t.taskType === initialSelectedTaskType)) {
      return initialSelectedTaskType;
    }
    return null;
  });

  useEffect(() => {
    if (!initialSelectedTaskType) return;
    if (!tasks.some((t) => t.taskType === initialSelectedTaskType)) return;
    setSelectedTaskType(initialSelectedTaskType);
  }, [initialSelectedTaskType, tasks]);

  const handleStartCall = () => {
    if (selectedTaskType !== null) {
      onStartCall(selectedTaskType);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <AppHeader />
      <section
        id="contenu"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12"
      >
        {homeHref && (
          <Link
            href={homeHref}
            className="text-muted-foreground hover:text-foreground mb-6 w-fit text-sm underline-offset-4 hover:underline"
          >
            ← Retour
          </Link>
        )}
        <h1 className="font-display text-headline">S’entraîner</h1>
        <p className="text-muted-foreground mt-2 max-w-prose">
          Choisissez une tâche : l’examinateur vous accueille, suit le déroulement officiel, puis
          votre passage est évalué.
        </p>

        <div
          role="radiogroup"
          aria-label="Tâche à travailler"
          className={cn(
            'mt-8 grid w-full grid-cols-1 gap-4',
            tasks.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
          )}
        >
          {tasks.map((task) => {
            const selected = selectedTaskType === task.taskType;
            return (
              <button
                key={task.taskType}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedTaskType(task.taskType)}
                className={cn(
                  'bg-card relative flex flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition-[border-color,box-shadow] duration-200 sm:p-6',
                  selected
                    ? 'border-primary shadow-raised'
                    : 'hover:border-primary/40 hover:shadow-card border-border'
                )}
              >
                <span
                  className={cn(
                    'font-display text-4xl leading-none',
                    selected ? 'text-primary' : 'text-highlight'
                  )}
                >
                  {task.id}
                </span>
                <span className="font-display text-title">{task.title}</span>
                <span className="text-muted-foreground text-sm">{task.description}</span>
                <span className="text-foreground mt-auto pt-2 text-sm font-medium">
                  {TIMINGS[task.taskType]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button
            variant="primary"
            size="lg"
            onClick={handleStartCall}
            disabled={selectedTaskType === null}
          >
            {startButtonText}
          </Button>
          <p className="text-muted-foreground text-sm">
            Autorisez le micro quand le navigateur le demande. Raccourci :{' '}
            <kbd className="bg-muted rounded border px-1.5 font-mono text-xs">M</kbd> pour le micro.
          </p>
        </div>
      </section>
    </div>
  );
}
