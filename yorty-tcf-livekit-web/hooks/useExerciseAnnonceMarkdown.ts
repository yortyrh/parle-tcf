'use client';

import { useEffect, useState } from 'react';

/**
 * Charge le markdown d'annonce pour un exercice TEF via l'API.
 * Les fichiers sont dans content/tef-annonces/ (hors public, non téléchargeables directement).
 */
export function useExerciseAnnonceMarkdown(exerciseId: string | null): {
  markdown: string | null;
  loading: boolean;
} {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!exerciseId) {
      setMarkdown(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/tef-annonce/${exerciseId}`)
      .then((res) => {
        if (!res.ok || cancelled) return null;
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setMarkdown(text ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setMarkdown(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  return { markdown, loading };
}
