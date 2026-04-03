'use client';

import { useEffect, useRef } from 'react';
import { toastAlert } from '@/components/ui/alert-toast';
import { useRealtimeExam } from '@/providers/realtime-exam-provider';

export function useRealtimeExamFatalToast() {
  const { fatalError, end } = useRealtimeExam();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (!fatalError || fatalError === prev.current) return;
    prev.current = fatalError;
    toastAlert({
      title: 'Session impossible',
      description: <p className="w-full">{fatalError}</p>,
    });
    end();
  }, [fatalError, end]);
}
