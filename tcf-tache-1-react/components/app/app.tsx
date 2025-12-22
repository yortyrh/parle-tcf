'use client';

import { useMemo, useState } from 'react';
import {
  RoomAudioRenderer,
  SessionProvider,
  StartAudio,
  useSession,
} from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/livekit/toaster';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useCustomTokenSource } from '@/hooks/useCustomTokenSource';
import { useDebugMode } from '@/hooks/useDebug';
import { useExamWarnings } from '@/hooks/useExamWarnings';
import { getSandboxTokenSource } from '@/lib/utils';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();
  useExamWarnings();

  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const [taskType, setTaskType] = useState<'tache1' | 'tache2' | 'tache3'>('tache1');
  const customTokenSource = useCustomTokenSource(appConfig, taskType);

  const tokenSource = useMemo(() => {
    return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
      ? getSandboxTokenSource(appConfig)
      : customTokenSource;
  }, [appConfig, customTokenSource]);

  const handleSelectionChange = (newTaskType: 'tache1' | 'tache2' | 'tache3') => {
    setTaskType(newTaskType);
  };

  const session = useSession(
    tokenSource,
    appConfig.agentName ? { agentName: appConfig.agentName } : undefined
  );

  return (
    <SessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController
          appConfig={appConfig}
          taskType={taskType}
          onSelectionChange={handleSelectionChange}
        />
      </main>
      <StartAudio label="Start Audio" />
      <RoomAudioRenderer />
      <Toaster />
    </SessionProvider>
  );
}
