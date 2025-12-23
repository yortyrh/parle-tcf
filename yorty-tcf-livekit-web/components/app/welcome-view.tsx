'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Task } from '@/app-config';
import { Button } from '@/components/livekit/button';
import { cn } from '@/lib/utils';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: (taskId: number) => void;
  tasks: Task[];
}

export function WelcomeView({ startButtonText, onStartCall, tasks }: WelcomeViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const handleStartCall = () => {
    if (selectedTaskId !== null) {
      onStartCall(selectedTaskId);
    }
  };

  return (
    <section className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
      <Image
        src="/logo.png"
        alt="TCF AI Logo"
        width={128}
        height={128}
        className="mb-6 h-32 w-32 object-contain"
      />
      <h1 className="mb-2 max-w-prose pt-1 text-lg leading-6 font-medium">
        Discutez en direct avec votre agent vocal TCF
      </h1>
      <p className="text-muted-foreground mb-8 text-sm">Sélectionnez une tâche pour commencer</p>

      {/* Task Selection Cards */}
      <div className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-4 md:grid-cols-3">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => setSelectedTaskId(task.id)}
            className={cn(
              'relative rounded-xl border-2 p-6 text-left transition-all duration-200',
              'hover:scale-105 hover:shadow-lg',
              selectedTaskId === task.id
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border bg-card hover:border-primary/50'
            )}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    selectedTaskId === task.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {task.id}
                </div>
                <h3 className="text-foreground text-base font-semibold">{task.title}</h3>
              </div>
              <p className="text-muted-foreground text-sm">{task.description}</p>
            </div>
            {selectedTaskId === task.id && (
              <div className="bg-primary absolute top-2 right-2 h-3 w-3 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={handleStartCall}
        disabled={selectedTaskId === null}
        className="w-64 font-mono disabled:cursor-not-allowed disabled:opacity-50"
      >
        {startButtonText}
      </Button>
    </section>
  );
}
