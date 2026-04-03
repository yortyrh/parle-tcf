'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Task } from '@/app-config';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: (taskType: string) => void;
  tasks: Task[];
  homeHref?: string;
}

export function WelcomeView({ startButtonText, onStartCall, tasks, homeHref }: WelcomeViewProps) {
  const [selectedTaskType, setSelectedTaskType] = useState<string | null>(null);

  const handleStartCall = () => {
    if (selectedTaskType !== null) {
      onStartCall(selectedTaskType);
    }
  };

  return (
    <section className="relative flex w-full flex-col items-center justify-center overflow-y-auto p-3 text-center sm:p-6">
      {homeHref && (
        <Link
          href={homeHref}
          className="text-muted-foreground hover:text-foreground absolute top-4 left-4 z-10 text-sm underline transition-colors"
        >
          ← Retour à la page principale
        </Link>
      )}
      <Image
        src="/logo.png"
        alt="TCF AI Logo"
        width={128}
        height={128}
        className="mb-4 h-20 w-20 object-contain sm:mb-6 sm:h-32 sm:w-32"
      />
      <h1 className="mb-1 max-w-prose px-4 pt-1 text-base leading-5 font-medium sm:mb-2 sm:text-lg sm:leading-6">
        Discutez en direct avec votre agent vocal
      </h1>
      <p className="text-muted-foreground mb-6 px-4 text-xs sm:mb-8 sm:text-sm">
        Sélectionnez une tâche pour commencer
      </p>

      {/* Task selection cards — 2 columns for TEF, 3 for TCF */}
      <div
        className={cn(
          'mb-6 grid w-full max-w-2xl grid-cols-1 gap-3 px-2 sm:mb-8 sm:gap-4 sm:px-0',
          tasks.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
        )}
      >
        {tasks.map((task) => (
          <button
            key={task.taskType}
            onClick={() => setSelectedTaskType(task.taskType)}
            className={cn(
              'relative rounded-lg border-2 p-4 text-left transition-all duration-200 sm:rounded-xl sm:p-6',
              'flex flex-col items-start justify-start',
              'active:scale-95 sm:hover:scale-105 sm:hover:shadow-lg',
              selectedTaskType === task.taskType
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border bg-card active:border-primary/50 sm:hover:border-primary/50'
            )}
          >
            <div className="flex w-full flex-col gap-1.5 sm:gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:h-8 sm:w-8 sm:text-sm',
                    selectedTaskType === task.taskType
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {task.id}
                </div>
                <h3 className="text-foreground text-sm font-semibold sm:text-base">{task.title}</h3>
              </div>
              <p className="text-muted-foreground text-xs leading-tight sm:text-sm sm:leading-normal">
                {task.description}
              </p>
            </div>
            {selectedTaskType === task.taskType && (
              <div className="bg-primary absolute top-2 right-2 h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3" />
            )}
          </button>
        ))}
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={handleStartCall}
        disabled={selectedTaskType === null}
        className="w-full max-w-xs font-mono text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:w-64 sm:text-base"
      >
        {startButtonText}
      </Button>
    </section>
  );
}
