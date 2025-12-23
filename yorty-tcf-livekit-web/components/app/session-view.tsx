'use client';

import React, { useEffect, useRef } from 'react';
import { useSessionContext, useSessionMessages } from '@livekit/components-react';
import type { AppConfig, Task } from '@/app-config';
import { ChatTranscript } from '@/components/app/chat-transcript';
import { TileLayout } from '@/components/app/tile-layout';
import {
  AgentControlBar,
  type ControlBarControls,
} from '@/components/livekit/agent-control-bar/agent-control-bar';
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
    <section className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden p-4">
      {/* Card Container */}
      <div className="border-border bg-card flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-solid shadow-lg transition-all duration-500">
        {/* Card Header with TileLayout and Task Info */}
        <div className="border-border flex items-center gap-4 border-b border-solid p-6 xl:p-7">
          {/* Left: Audio Visualizer */}
          <div className="flex-shrink-0">
            <TileLayout />
          </div>

          {/* Right: Task Information */}
          <div className="flex flex-col gap-2">
            <h4 className="text-foreground text-base leading-snug font-semibold capitalize transition-all duration-500">
              {selectedTask?.title || 'Tâche'}
            </h4>
            <p className="text-muted-foreground text-sm leading-5 font-normal transition-all duration-500">
              {selectedTask?.description || 'Description de la tâche'}
            </p>
          </div>
        </div>

        {/* Chat Transcript Area */}
        <div className="relative flex-1 overflow-hidden bg-gray-50">
          <Fade top className="absolute inset-x-4 top-0 z-10 h-8" />
          <ScrollArea ref={scrollAreaRef} className="h-full px-6 pt-8 pb-4 xl:px-8">
            <ChatTranscript hidden={false} messages={messages} className="mx-auto space-y-3" />
          </ScrollArea>
        </div>

        {/* Bottom Controls */}
        <div className="border-border border-t border-solid bg-white p-4 xl:p-6">
          <div className="relative mx-auto">
            <AgentControlBar
              controls={controls}
              isConnected={session.isConnected}
              onDisconnect={session.end}
              onChatOpenChange={() => {}}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
