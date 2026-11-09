'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AttemptDetail } from '@parle-tcf/shared';
import { api } from '@/lib/api';

const POLL_MS = 2000;

/** Loads an attempt and polls every 2 s while its evaluation is in flight. */
export function useAttempt(attemptId: string) {
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setAttempt(await api.getAttempt(attemptId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement.');
    }
  }, [attemptId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const status = attempt?.evaluationStatus;
  useEffect(() => {
    if (status !== 'pending' && status !== 'running') return;
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [status, refresh]);

  return { attempt, error, refresh };
}
