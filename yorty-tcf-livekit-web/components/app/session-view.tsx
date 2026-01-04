'use client';

import React, { useEffect, useRef } from 'react';
import { useSessionContext, useSessionMessages } from '@livekit/components-react';
import type { AppConfig, Task } from '@/app-config';
import { ChatTranscript } from '@/components/app/chat-transcript';
import { TimerDisplay } from '@/components/app/timer-display';
import {
  AgentControlBar,
  type ControlBarControls,
} from '@/components/livekit/agent-control-bar/agent-control-bar';
import { useExerciseData, useTimerControls } from '@/hooks';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../livekit/scroll-area/scroll-area';

function Fade({
  top = false,
  bottom = false,
  className = '',
}: {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 to-transparent',
        top && 'bg-gradient-to-b',
        bottom && 'bg-gradient-to-t',
        className
      )}
    />
  );
}

interface SessionViewProps {
  appConfig: AppConfig;
  selectedTask: Task | null;
}

export function SessionView({ appConfig, selectedTask }: SessionViewProps) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { timerState } = useTimerControls();
  const exerciseData = useExerciseData();

  const controls: ControlBarControls = {
    leave: true,
    microphone: true,
    chat: appConfig.supportsChatInput,
    camera: false,
    screenShare: false,
  };

  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (scrollAreaRef.current && lastMessage?.from?.isLocal) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden p-2 sm:p-4">
      {/* Card Container */}
      <div className="border-border bg-card flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-solid shadow-lg transition-all duration-500 sm:rounded-2xl">
        {/* Card Header with Task Info */}
        <div className="border-border flex items-start gap-3 border-b border-solid p-4 sm:flex-row sm:gap-4">
          {/* Task Information */}
          <div className="mx-auto flex min-w-0 max-w-[860px] flex-1 flex-col gap-4">
            {/* Description */}
            <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50/50 px-4 py-3 shadow-md sm:px-5 sm:py-4 min-h-[90px] flex items-center">
              <p className="text-cyan-600 font-semibold line-clamp-10 text-base leading-relaxed sm:text-lg sm:leading-relaxed">
                {exerciseData?.description || selectedTask?.description || 'Description de la tâche'}
              </p>
            </div>
            
            {/* Task Labels/Badges - Below Description */}
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              {(() => {
                const title = exerciseData?.title || selectedTask?.title || 'Tâche';
                // Split title by " - " to separate task number from exercise type
                const parts = title.split(' - ');
                const taskNumber = parts[0] || 'Tâche';
                const exerciseType = parts[1] || 'Jeu de rôle';

                return (
                  <>
                    <span className="inline-flex items-center rounded bg-cyan-700 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-cyan-600/30 ring-inset sm:px-2 sm:py-1 sm:text-xs">
                      {taskNumber}
                    </span>
                    <span className="inline-flex items-center rounded bg-cyan-600 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-cyan-500/30 ring-inset sm:px-2 sm:py-1 sm:text-xs">
                      {exerciseType}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
          {/* Timer Display - Top Right */}
          {timerState.type && timerState.isRunning && (
            <div className="ml-auto flex items-center">
              <TimerDisplay timerState={timerState} />
            </div>
          )}
        </div>

        {/* Chat Transcript Area */}
        <div className="relative flex-1 overflow-hidden bg-gray-50">
          <Fade top className="absolute inset-x-2 top-0 z-10 h-6 sm:inset-x-4 sm:h-8" />
          <ScrollArea
            ref={scrollAreaRef}
            className="h-full px-3 pt-6 pb-3 sm:px-6 sm:pt-8 sm:pb-4 xl:px-8"
          >
            <ChatTranscript
              hidden={false}
              messages={messages}
              className="mx-auto space-y-2 sm:space-y-3"
            />
          </ScrollArea>
        </div>

        {/* Bottom Controls */}
        <div className="border-border border-t border-solid bg-white p-2 sm:p-4 xl:p-6">
          <div className="relative mx-auto">
            <AgentControlBar
              controls={controls}
              isConnected={session.isConnected}
              onDisconnect={session.end}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
