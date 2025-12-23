import { useEffect } from 'react';
import { setLogLevel } from 'livekit-client';

export function useDebugMode({ enabled = false }: { enabled?: boolean } = {}) {
  useEffect(() => {
    setLogLevel(enabled ? 'debug' : 'warn');
  }, [enabled]);
}
