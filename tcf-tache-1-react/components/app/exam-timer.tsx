'use client';

import { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';

interface ExamTimerProps {
  taskType: 'tache1' | 'tache2' | 'tache3';
  isConnected: boolean;
}

export function ExamTimer({ taskType, isConnected }: ExamTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const room = useRoomContext();

  // Listen for start_timer message from agent
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(payload);
        const message = JSON.parse(text);

        if (message.type === 'start_timer') {
          console.log('Received start_timer message. Starting countdown...');
          const duration = message.duration || 120;
          setTimerStarted(true);
          setTimeRemaining(Math.round(duration - (Date.now() - message.currentTime) / 1000));
        }
      } catch (error) {
        console.error('Error parsing timer message:', error);
      }
    };

    room.on('dataReceived', handleData);

    return () => {
      room.off('dataReceived', handleData);
    };
  }, [room]);

  // Countdown timer
  useEffect(() => {
    // Ne démarrer le compte à rebours que si on est connecté et que le timer a été démarré
    if (!isConnected || !timerStarted) {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, timerStarted]);

  // Send end_exam message when timer reaches 0
  useEffect(() => {
    if (timeRemaining === 0 && timerStarted && room) {
      console.log('Timer reached 0. Sending end_exam message...');

      const sendEndExam = async () => {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(
            JSON.stringify({
              type: 'end_exam',
              message: 'Le temps est écoulé',
            })
          );
          await room.localParticipant?.publishData(data, { reliable: true });
        } catch (error) {
          console.error('Error sending end_exam message:', error);
        }
      };

      sendEndExam();
    }
  }, [timeRemaining, timerStarted, room]);

  // Ne rien afficher si on n'est pas connecté
  if (!isConnected) {
    return null;
  }

  // Si le timer n'a pas encore démarré, afficher un message d'attente
  if (!timerStarted) {
    return (
      <div
        className="fixed top-4 left-1/2 z-50 -translate-x-1/2 transform rounded-lg px-6 py-4 font-mono text-lg font-semibold shadow-lg"
        style={{
          backgroundColor: 'rgba(59, 130, 246, 0.95)',
          color: 'white',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="animate-pulse text-xl">⏳</span>
          <span>En attente du début de l&apos;examen...</span>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isWarning = timeRemaining <= 30; // Avertissement dans les 30 dernières secondes
  const isCritical = timeRemaining <= 10; // Critique dans les 10 dernières secondes

  return (
    <div
      className="fixed top-4 left-1/2 z-50 -translate-x-1/2 transform rounded-lg px-6 py-4 font-mono text-2xl font-bold shadow-lg"
      style={{
        backgroundColor: isCritical
          ? 'rgba(220, 38, 38, 0.95)'
          : isWarning
            ? 'rgba(245, 158, 11, 0.95)'
            : 'rgba(34, 197, 94, 0.95)',
        color: 'white',
        transition: 'all 0.3s ease',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">⏱️</span>
        <span>
          {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </span>
      </div>
      {timeRemaining <= 15 && (
        <div className="mt-1 animate-pulse text-center text-xs font-normal">
          L&apos;examen se termine bientôt
        </div>
      )}
      {timeRemaining === 0 && (
        <div className="mt-1 text-center text-xs font-normal">
          Temps écoulé - Veuillez patienter
        </div>
      )}
    </div>
  );
}
