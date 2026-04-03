import { useEffect } from 'react';

export function useDebugMode({ enabled = false }: { enabled?: boolean } = {}) {
  useEffect(() => {
    if (enabled && typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.debug('[yorty-tcf] debug mode enabled');
    }
  }, [enabled]);
}
