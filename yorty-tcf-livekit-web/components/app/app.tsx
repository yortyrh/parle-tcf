'use client';

import { useMemo, useRef, useState } from 'react';
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
  const defaultTaskType = appConfig.tasks[0]?.taskType ?? 'tache1';
  const [, setTaskType] = useState<string>(defaultTaskType);
  const connectTaskTypeRef = useRef<string>(defaultTaskType);

  // TokenSource.custom wraps a direct fetch so that every call reads the
  // *current* connectTaskTypeRef value. We intentionally bypass
  // TokenSource.endpoint() because its internal TokenSourceCached returns
  // stale tokens when options change (it caches on "different options" and
  // refetches on "same options" — opposite of expected). Without this, the
  // eager prepareConnection() that useSession fires on mount always locks in
  // the default task type and subsequent start() calls reuse that cached token.
  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async () => {
        const response = await fetch('/api/connection-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_metadata: JSON.stringify({ taskType: connectTaskTypeRef.current }),
          }),
        });
        if (!response.ok) {
          throw new Error(`Token fetch failed: ${response.status} ${await response.text()}`);
        }
        return response.json();
      }),
    []
  );

  const session = useSession(tokenSource, {});

  return (
    <SessionProvider session={session}>
      <AppSetup />
      <main className="h-svh">
        <ViewController
          appConfig={appConfig}
          connectTaskTypeRef={connectTaskTypeRef}
          onTaskSelect={setTaskType}
          homeHref={homeHref}
        />
      </main>
      <StartAudio label="Démarrer l'audio" />
      <RoomAudioRenderer />
      <Toaster />
    </SessionProvider>
  );
}
