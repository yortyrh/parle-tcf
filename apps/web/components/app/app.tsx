'use client';

import { useMemo, useRef, useState } from 'react';
import type { AppConfig } from '@/app-config';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/toaster';
import { useRealtimeExamFatalToast } from '@/hooks/useRealtimeExamFatalToast';
import { RealtimeExamProvider } from '@/providers/realtime-exam-provider';

function AppSetup() {
  useRealtimeExamFatalToast();
  return null;
}

interface AppProps {
  appConfig: AppConfig;
  homeHref?: string;
  welcomeHref?: string;
  routeByTask?: boolean;
  initialTaskType?: string;
  initialExerciseId?: string;
}

export function App({
  appConfig,
  homeHref,
  welcomeHref,
  routeByTask,
  initialTaskType,
  initialExerciseId,
}: AppProps) {
  const defaultTaskType = appConfig.tasks[0]?.taskType ?? 'tache1';
  const [, setTaskType] = useState<string>(initialTaskType ?? defaultTaskType);
  const connectTaskTypeRef = useRef<string>(initialTaskType ?? defaultTaskType);
  const connectExerciseIdRef = useRef<string | undefined>(initialExerciseId);

  const viewProps = useMemo(
    () => ({
      appConfig,
      connectTaskTypeRef,
      connectExerciseIdRef,
      onTaskSelect: setTaskType,
      homeHref,
      welcomeHref,
      routeByTask,
      initialTaskType,
      initialExerciseId,
    }),
    [appConfig, homeHref, welcomeHref, routeByTask, initialTaskType, initialExerciseId]
  );

  return (
    <RealtimeExamProvider>
      <AppSetup />
      <main className="h-svh">
        <ViewController {...viewProps} />
      </main>
      <Toaster />
    </RealtimeExamProvider>
  );
}
