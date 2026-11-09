'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { TaskType } from '@parle-tcf/shared';
import { TASK_DURATIONS } from '@parle-tcf/shared';
import { APP_CONFIG_DEFAULTS } from '@/app-config';
import { PreparationView } from '@/components/app/preparation-view';
import { SessionView } from '@/components/app/session-view';
import { ConnectingSkeleton } from '@/components/app/view-controller';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useRealtimeExamFatalToast } from '@/hooks';
import { RealtimeExamProvider, useRealtimeExam } from '@/providers/realtime-exam-provider';

const STEPS: TaskType[] = ['tache1', 'tache2', 'tache3'];

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min} min` : `${min} min ${String(sec).padStart(2, '0')}`;
}

/** Full exam: the three tasks chained under one run, with official times. */
export function ExamRunApp() {
  return (
    <RealtimeExamProvider>
      <ExamRunController />
      <Toaster />
    </RealtimeExamProvider>
  );
}

function ExamRunController() {
  const exam = useRealtimeExam();
  const router = useRouter();
  useRealtimeExamFatalToast();

  /** Index of the task being run; null before the start, STEPS.length when over. */
  const [step, setStep] = useState<number | null>(null);
  const runIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (exam.runId) runIdRef.current = exam.runId;
  }, [exam.runId]);

  useEffect(() => {
    if (exam.needsProviderKey) router.push('/parametres');
  }, [exam.needsProviderKey, router]);

  // A failed start (no key, network...) puts the candidate back on the intro screen.
  useEffect(() => {
    if (step !== null && step < STEPS.length && exam.fatalError && !exam.isConnecting) {
      setStep(null);
    }
  }, [step, exam.fatalError, exam.isConnecting]);

  async function runTask(index: number) {
    setStep(index);
    await exam.start(STEPS[index]!, undefined, { mode: 'full', runId: runIdRef.current });
  }

  async function nextTask() {
    const next = (step ?? 0) + 1;
    exam.end();
    if (next >= STEPS.length) {
      setStep(STEPS.length);
      return;
    }
    await runTask(next);
  }

  if (step === null) {
    return (
      <section className="flex min-h-svh items-center justify-center p-4">
        <div className="bg-card flex w-full max-w-xl flex-col gap-4 rounded-2xl border p-6 shadow-lg">
          <h1 className="text-xl font-semibold">Examen complet</h1>
          <p className="text-muted-foreground text-sm">
            Les trois tâches s&apos;enchaînent comme à l&apos;épreuve réelle, avec le temps
            officiel. Le chronomètre met fin à chaque tâche : l&apos;examinateur clôt l&apos;épreuve
            quand le temps est écoulé.
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            {STEPS.map((task, i) => {
              const { preparationS, speakingS } = TASK_DURATIONS[task];
              return (
                <li key={task} className="flex justify-between gap-3 rounded-lg border p-3">
                  <span className="font-medium">Tâche {i + 1}</span>
                  <span className="text-muted-foreground">
                    {preparationS > 0 ? `préparation ${formatDuration(preparationS)} · ` : ''}
                    expression {formatDuration(speakingS)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground text-xs">
            Prévoyez un endroit au calme et autorisez le micro. Les sessions sont facturées sur
            votre clé OpenAI.
          </p>
          <div className="flex items-center justify-between gap-3">
            <Link href="/tcf" className="text-muted-foreground text-sm underline">
              ← Entraînement libre
            </Link>
            <Button variant="primary" size="lg" onClick={() => void runTask(0)}>
              Commencer l&apos;examen
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (step >= STEPS.length) {
    return (
      <section className="flex min-h-svh items-center justify-center p-4">
        <div className="bg-card flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border p-6 text-center shadow-lg">
          <h1 className="text-xl font-semibold">Examen terminé</h1>
          <p className="text-muted-foreground text-sm">
            Vos trois tâches sont enregistrées. Les évaluations arrivent en quelques secondes dans
            l’historique.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => setStep(null)}>
              Refaire un examen
            </Button>
            <Button asChild variant="secondary">
              <Link href="/historique">Voir l&apos;historique</Link>
            </Button>
            <Button asChild>
              <Link href="/tcf">Entraînement libre</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const task = APP_CONFIG_DEFAULTS.tasks.find((t) => t.taskType === STEPS[step]) ?? null;

  if (exam.preparation) {
    return (
      <PreparationView
        secondsLeft={exam.preparation.secondsLeft}
        exerciseText={exam.exerciseData?.content || exam.exerciseData?.description || ''}
        onSkip={exam.skipPreparation}
      />
    );
  }

  if (!exam.isConnected) {
    return <ConnectingSkeleton />;
  }

  const isLast = step === STEPS.length - 1;
  return (
    <div className="relative h-svh">
      <SessionView appConfig={APP_CONFIG_DEFAULTS} selectedTask={task} />
      <div
        className="bg-card/95 absolute top-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-1.5 text-xs shadow-md"
        aria-live="polite"
      >
        <span className="font-semibold">
          Examen · tâche {step + 1}/{STEPS.length}
        </span>
        {exam.attemptCompleted && (
          <Button size="sm" variant="primary" onClick={() => void nextTask()}>
            {isLast ? "Terminer l'examen" : 'Tâche suivante'}
          </Button>
        )}
      </div>
    </div>
  );
}
