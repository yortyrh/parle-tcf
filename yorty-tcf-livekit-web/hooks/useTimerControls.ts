import { useEffect, useRef, useState } from 'react';

/**
 * Hook that tracks session elapsed time.
 * Starts counting as soon as the hook mounts (session begins).
 */
export function useSessionTimer() {
  const startTimeRef = useRef(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return { elapsedSeconds };
}
