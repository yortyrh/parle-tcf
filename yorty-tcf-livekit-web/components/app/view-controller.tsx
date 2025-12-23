'use client';

import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';

interface ViewControllerProps {
  appConfig: AppConfig;
}

export function ViewController({ appConfig }: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();

  if (!isConnected) {
    return <WelcomeView startButtonText={appConfig.startButtonText} onStartCall={start} />;
  }

  return <SessionView appConfig={appConfig} />;
}
