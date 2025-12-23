'use client';

import { useState } from 'react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig, Task } from '@/app-config';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';

interface ViewControllerProps {
  appConfig: AppConfig;
  onTaskSelect: (taskId: number) => void;
}

export function ViewController({ appConfig, onTaskSelect }: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleStartCall = (taskId: number) => {
    const task = appConfig.tasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      onTaskSelect(taskId);
      start();
    }
  };

  if (!isConnected) {
    return (
      <WelcomeView
        startButtonText={appConfig.startButtonText}
        onStartCall={handleStartCall}
        tasks={appConfig.tasks}
      />
    );
  }

  return <SessionView appConfig={appConfig} selectedTask={selectedTask} />;
}
