'use client';

import type { MutableRefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig, Task } from '@/app-config';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';

interface ViewControllerProps {
  appConfig: AppConfig;
  /** Updated synchronously before connect so the token uses the chosen task, not stale React state. */
  connectTaskTypeRef: MutableRefObject<string>;
  /** Updated synchronously before connect to include a specific exercise ID in metadata. */
  connectExerciseIdRef: MutableRefObject<string | undefined>;
  onTaskSelect: (taskType: string) => void;
  homeHref?: string;
  /** Welcome page URL for this exam (e.g. /tcf, /tef). Navigated to when the session ends. */
  welcomeHref?: string;
  /**
   * When true, clicking "Commencer" navigates to `welcomeHref/taskType` via the router so the
   * browser Back button returns to the welcome page. The auto-connect effect then starts the
   * session. When false (TEF and other exams without URL-based task routing), the session starts
   * directly from the welcome page.
   */
  routeByTask?: boolean;
  /** Pre-selected task type from the URL (triggers auto-connect on mount). */
  initialTaskType?: string;
  /** Pre-selected exercise ID from the URL. */
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
  const { isConnected, start, end } = useSessionContext();
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<Task | null>(() =>
    initialTaskType ? (appConfig.tasks.find((t) => t.taskType === initialTaskType) ?? null) : null
  );
  const autoConnectFired = useRef(false);
  const wasConnectedRef = useRef(false);
  const isMountedRef = useRef(true);
  // Keep a stable ref to end() so it can be used inside the unmount cleanup without
  // adding end to the effect's dependency array (which could cause premature cleanup).
  const endRef = useRef(end);
  endRef.current = end;

  // Explicitly disconnect the LiveKit session when this component unmounts.
  // Without this, navigating away via the browser Back button leaves the agent running
  // and a subsequent session would start a second agent in parallel (duplicate voices).
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void endRef.current();
    };
  }, []);

  // Navigate back to the welcome page when the session ends (isConnected goes true → false).
  // The isMountedRef guard prevents a stale navigation if the component already unmounted
  // (e.g. the Back button navigated away before this effect fired).
  useEffect(() => {
    if (isConnected) {
      wasConnectedRef.current = true;
    } else if (wasConnectedRef.current && welcomeHref && isMountedRef.current) {
      wasConnectedRef.current = false;
      router.replace(welcomeHref);
    }
  }, [isConnected, router, welcomeHref]);

  // Starts the LiveKit session for the given task and optional exercise ID.
  const startSession = (taskType: string, exerciseId?: string) => {
    const task = appConfig.tasks.find((t) => t.taskType === taskType);
    if (task) {
      connectTaskTypeRef.current = taskType;
      connectExerciseIdRef.current = exerciseId;
      setSelectedTask(task);
      onTaskSelect(taskType);
      start({ tracks: { microphone: { enabled: false } } });
    }
  };

  // When routeByTask is enabled, navigate to the task URL so the Back button returns to the
  // welcome page; the auto-connect effect handles the actual LiveKit connection.
  // Otherwise (TEF and similar), start the session directly from the welcome page.
  const handleWelcomeStart = (taskType: string) => {
    if (routeByTask && welcomeHref) {
      router.push(`${welcomeHref}/${taskType}`);
    } else {
      startSession(taskType);
    }
  };

  // Auto-connect when arriving from a URL that already encodes a task (page refresh or navigation
  // from the welcome page via router.push).
  useEffect(() => {
    if (autoConnectFired.current || !initialTaskType || isConnected) return;
    autoConnectFired.current = true;
    startSession(initialTaskType, initialExerciseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isConnected) {
    // initialTaskType is set when the URL encodes a task — auto-connect is in progress.
    // Show a skeleton that mirrors the session layout to avoid a jarring UI flash.
    if (initialTaskType) {
      return <ConnectingSkeleton />;
    }
    return (
      <WelcomeView
        startButtonText={appConfig.startButtonText}
        onStartCall={handleWelcomeStart}
        tasks={appConfig.tasks}
        homeHref={homeHref}
      />
    );
  }

  return <SessionView appConfig={appConfig} selectedTask={selectedTask} />;
}

/**
 * Skeleton placeholder shown while the LiveKit session is connecting.
 * Mirrors the structure of SessionView (tab bar, content, bottom bar).
 * Shows two boxes — cyan exercise/description + amber mic hint — for all task types,
 * since "Connexion de l'examinateur" is no longer shown in the live session view.
 */
function ConnectingSkeleton() {
  return (
    <section className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b from-slate-100/70 via-slate-50/40 to-white p-2 sm:p-4">
      <div className="border-border/70 bg-card/95 relative flex h-full w-full max-w-3xl animate-pulse flex-col overflow-hidden rounded-xl border border-solid shadow-xl ring-1 ring-black/5 backdrop-blur sm:rounded-2xl">
        {/* ── Tab bar ── */}
        <div className="border-border/70 flex items-end border-b bg-white/60 px-3 pt-2">
          <div className="flex flex-1 gap-0">
            {[28, 24, 36].map((w, i) => (
              <div
                key={i}
                className={`bg-muted/70 mb-0 h-9 flex-1 rounded-t-md sm:flex-none sm:w-${w}`}
              />
            ))}
          </div>
          <div className="bg-muted mb-1.5 ml-2 h-6 w-24 flex-shrink-0 rounded-lg" />
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="flex h-full flex-col gap-3">
            {/* Cyan exercise / description box */}
            <div className="flex min-h-[88px] items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-50/60 px-4 py-3 shadow-sm">
              <div className="w-full">
                <div className="mb-2.5 h-4 w-3/4 rounded-md bg-cyan-200/60" />
                <div className="mb-2 h-4 w-full rounded-md bg-cyan-200/60" />
                <div className="mb-2 h-4 w-5/6 rounded-md bg-cyan-200/60" />
                <div className="h-4 w-2/3 rounded-md bg-cyan-200/60" />
              </div>
            </div>

            {/* Amber "Micro désactivé" */}
            <div className="mt-auto rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 shadow-sm">
              <div className="mb-2 h-3.5 w-1/3 rounded-md bg-amber-200/70" />
              <div className="mb-1.5 h-3 w-full rounded-md bg-amber-200/50" />
              <div className="mb-1.5 h-3 w-5/6 rounded-md bg-amber-200/50" />
              <div className="h-3 w-3/4 rounded-md bg-amber-200/50" />
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
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
