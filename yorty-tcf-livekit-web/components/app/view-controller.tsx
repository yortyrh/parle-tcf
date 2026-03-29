'use client';

import type { MutableRefObject } from 'react';
import { useState } from 'react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig, Task } from '@/app-config';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';

interface ViewControllerProps {
  appConfig: AppConfig;
  /** Updated synchronously before connect so the token uses the chosen task, not stale React state. */
  connectTaskTypeRef: MutableRefObject<string>;
  onTaskSelect: (taskType: string) => void;
  homeHref?: string;
}

export function ViewController({
  appConfig,
  connectTaskTypeRef,
  onTaskSelect,
  homeHref,
}: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleStartCall = (taskType: string) => {
    const task = appConfig.tasks.find((t) => t.taskType === taskType);
    if (task) {
      connectTaskTypeRef.current = taskType;
      setSelectedTask(task);
      onTaskSelect(taskType);
      start({ tracks: { microphone: { enabled: false } } });
    }
  };

  if (!isConnected) {
    return (
      <WelcomeView
        startButtonText={appConfig.startButtonText}
        onStartCall={handleStartCall}
        tasks={appConfig.tasks}
        homeHref={homeHref}
      />
    );
  }

  return <SessionView appConfig={appConfig} selectedTask={selectedTask} />;
}
