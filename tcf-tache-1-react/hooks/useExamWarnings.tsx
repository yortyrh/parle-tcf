'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRoomContext } from '@livekit/components-react';

interface ExamMessage {
  type: 'start_timer' | 'exam_end' | 'end_exam';
  message: string;
  secondsRemaining?: number;
}

export function useExamWarnings() {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const data: ExamMessage = JSON.parse(text);

        // Only handle start_timer message to show a notification
        if (data.type === 'start_timer') {
          toast.success("L'examen commence maintenant !", {
            duration: 3000,
            position: 'top-center',
            style: {
              fontSize: '1.1rem',
              fontWeight: 'bold',
            },
          });
        }
      } catch (error) {
        console.error('Error parsing exam message:', error);
      }
    };

    room.on('dataReceived', handleData);

    return () => {
      room.off('dataReceived', handleData);
    };
  }, [room]);
}
