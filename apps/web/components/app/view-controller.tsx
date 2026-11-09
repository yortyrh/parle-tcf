'use client';

import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { AppConfig, Task } from '@/app-config';
import { PreparationView } from '@/components/app/preparation-view';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';
import { useRealtimeExam } from '@/providers/realtime-exam-provider';

interface ViewControllerProps {
  appConfig: AppConfig;
  connectTaskTypeRef: MutableRefObject<string>;
  connectExerciseIdRef: MutableRefObject<string | undefined>;
  onTaskSelect: (taskType: string) => void;
  homeHref?: string;
  welcomeHref?: string;
  routeByTask?: boolean;
  initialTaskType?: string;
  initialExerciseId?: string;
}

export function ViewController({
  appConfig,
  connectTaskTypeRef,
  connectExerciseIdRef,
  onTaskSelect,
  homeHref,
  welcomeHref,
  routeByTask,
  initialTaskType,
  initialExerciseId,
}: ViewControllerProps) {
  const exam = useRealtimeExam();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedTask, setSelectedTask] = useState<Task | null>(() =>
    initialTaskType ? (appConfig.tasks.find((t) => t.taskType === initialTaskType) ?? null) : null
  );
  /** Dernière route pour laquelle on a tenté une auto-connexion (évite boucles si l’appel échoue). */
  const autoConnectAttemptKeyRef = useRef<string | null>(null);
  const wasConnectedRef = useRef(false);
  const isMountedRef = useRef(true);
  const endRef = useRef(exam.end);
  endRef.current = exam.end;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Also lets the auto-connect effect run again when React StrictMode remounts.
      autoConnectAttemptKeyRef.current = null;
      void endRef.current();
    };
  }, []);

  /** Last practice attempt saved in this session: its result page opens on hang-up. */
  const lastResultRef = useRef<string | null>(null);
  useEffect(() => {
    if (exam.attemptCompleted && exam.attemptId && exam.mode === 'practice') {
      lastResultRef.current = exam.attemptId;
    }
  }, [exam.attemptCompleted, exam.attemptId, exam.mode]);

  useEffect(() => {
    if (exam.needsProviderKey) router.push('/parametres');
  }, [exam.needsProviderKey, router]);

  useEffect(() => {
    if (exam.isConnected) {
      wasConnectedRef.current = true;
    } else if (
      wasConnectedRef.current &&
      !exam.isRestarting &&
      welcomeHref &&
      isMountedRef.current
    ) {
      wasConnectedRef.current = false;
      const resultId = lastResultRef.current;
      lastResultRef.current = null;
      router.replace(resultId ? `/resultats/${resultId}` : welcomeHref);
    }
  }, [exam.isConnected, exam.isRestarting, router, welcomeHref]);

  const startSession = useCallback(
    (taskType: string, exerciseId?: string) => {
      const task = appConfig.tasks.find((t) => t.taskType === taskType);
      if (task) {
        connectTaskTypeRef.current = taskType;
        connectExerciseIdRef.current = exerciseId;
        setSelectedTask(task);
        onTaskSelect(taskType);
        void exam.start(taskType, exerciseId);
      }
    },
    [appConfig.tasks, connectExerciseIdRef, connectTaskTypeRef, exam, onTaskSelect]
  );

  const handleWelcomeStart = (taskType: string) => {
    if (routeByTask && welcomeHref) {
      const targetPath = `${welcomeHref}/${taskType}`;
      if (pathname === targetPath || pathname === `${targetPath}/`) {
        void startSession(taskType, initialExerciseId);
        return;
      }
      router.push(targetPath);
    } else {
      startSession(taskType);
    }
  };

  useEffect(() => {
    if (!initialTaskType) {
      autoConnectAttemptKeyRef.current = null;
      return;
    }
    if (exam.isConnected || exam.isConnecting) return;

    const key = `${initialTaskType}:${initialExerciseId ?? ''}`;
    if (autoConnectAttemptKeyRef.current === key) return;

    autoConnectAttemptKeyRef.current = key;
    void startSession(initialTaskType, initialExerciseId);
  }, [initialTaskType, initialExerciseId, exam.isConnected, exam.isConnecting, startSession]);

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
    if (exam.isConnecting || exam.isRestarting) {
      return <ConnectingSkeleton />;
    }
    return (
      <WelcomeView
        startButtonText={appConfig.startButtonText}
        onStartCall={handleWelcomeStart}
        tasks={appConfig.tasks}
        homeHref={homeHref}
        initialSelectedTaskType={initialTaskType ?? null}
      />
    );
  }

  return <SessionView appConfig={appConfig} selectedTask={selectedTask} />;
}

export function ConnectingSkeleton() {
  return (
    <section className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b from-slate-100/70 via-slate-50/40 to-white p-2 sm:p-4">
      <div className="border-border/70 bg-card/95 relative flex h-full w-full max-w-3xl animate-pulse flex-col overflow-hidden rounded-xl border border-solid shadow-xl ring-1 ring-black/5 backdrop-blur sm:rounded-2xl">
        <div className="border-border/70 flex items-end border-b bg-white/60 px-3 pt-2">
          <div className="flex min-w-0 flex-1 gap-0">
            <div className="bg-muted/70 mb-0 h-9 min-w-0 flex-1 rounded-t-md sm:w-28 sm:flex-none" />
            <div className="bg-muted/70 mb-0 h-9 min-w-0 flex-1 rounded-t-md sm:w-24 sm:flex-none" />
            <div className="bg-muted/70 mb-0 h-9 min-w-0 flex-1 rounded-t-md sm:w-36 sm:flex-none" />
          </div>
          <div className="bg-muted mb-1.5 ml-2 h-6 w-24 shrink-0 rounded-lg" />
        </div>

        <div className="flex min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="flex min-h-0 w-full flex-col gap-3">
            <div className="flex min-h-[88px] items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-50/60 px-4 py-3 shadow-sm">
              <div className="w-full">
                <div className="mb-2.5 h-4 w-3/4 rounded-md bg-cyan-200/60" />
                <div className="mb-2 h-4 w-full rounded-md bg-cyan-200/60" />
                <div className="mb-2 h-4 w-5/6 rounded-md bg-cyan-200/60" />
                <div className="h-4 w-2/3 rounded-md bg-cyan-200/60" />
              </div>
            </div>

            <div className="mt-auto rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 shadow-sm">
              <div className="mb-2 h-3.5 w-1/3 rounded-md bg-amber-200/70" />
              <div className="mb-1.5 h-3 w-full rounded-md bg-amber-200/50" />
              <div className="mb-1.5 h-3 w-5/6 rounded-md bg-amber-200/50" />
              <div className="h-3 w-3/4 rounded-md bg-amber-200/50" />
            </div>
          </div>
        </div>

        <div className="border-border/70 border-t bg-white/95 px-3 py-2 sm:px-4 sm:py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="bg-muted h-9 w-16 rounded-md" />
            <div className="bg-muted h-4 w-10 rounded-md" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="bg-muted h-9 w-28 rounded-lg" />
            <div className="bg-muted h-9 w-20 rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}
