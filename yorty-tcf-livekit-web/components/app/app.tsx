'use client';

import { useState } from 'react';
import { TokenSource } from 'livekit-client';
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
import { useDebugMode } from '@/hooks/useDebug';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();
  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const [taskId, setTaskId] = useState<number>(1);
  const session = useSession(TokenSource.endpoint('/api/connection-details'), {
    participantMetadata: JSON.stringify({
      taskType: `tache${taskId}`,
    }),
  });

  return (
    <SessionProvider session={session}>
      <AppSetup />
      <main className="h-svh">
        <ViewController appConfig={appConfig} onTaskSelect={setTaskId} />
      </main>
      <StartAudio label="Démarrer l'audio" />
      <RoomAudioRenderer />
      <Toaster />
    </SessionProvider>
  );
}
