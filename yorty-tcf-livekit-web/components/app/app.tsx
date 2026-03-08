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
  /** URL de la page principale (affiche le lien "Retour" lorsque défini) */
  homeHref?: string;
}

export function App({ appConfig, homeHref }: AppProps) {
  const [taskType, setTaskType] = useState<string>(appConfig.tasks[0]?.taskType ?? 'tache1');
  const session = useSession(TokenSource.endpoint('/api/connection-details'), {
    participantMetadata: JSON.stringify({
      taskType,
    }),
  });

  return (
    <SessionProvider session={session}>
      <AppSetup />
      <main className="h-svh">
        <ViewController appConfig={appConfig} onTaskSelect={setTaskType} homeHref={homeHref} />
      </main>
      <StartAudio label="Démarrer l'audio" />
      <RoomAudioRenderer />
      <Toaster />
    </SessionProvider>
  );
}
