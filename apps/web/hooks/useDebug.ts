import { useEffect } from 'react';

export function useDebugMode({ enabled = false }: { enabled?: boolean } = {}) {
  useEffect(() => {
    if (enabled && typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.debug('[parle-tcf] debug mode enabled');
    }
  }, [enabled]);
}
