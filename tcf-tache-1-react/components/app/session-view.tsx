'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useSessionContext, useSessionMessages } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { ChatTranscript } from '@/components/app/chat-transcript';
import { ExamTimer } from '@/components/app/exam-timer';
import { PreConnectMessage } from '@/components/app/preconnect-message';
import { TileLayout } from '@/components/app/tile-layout';
import {
  AgentControlBar,
  type ControlBarControls,
} from '@/components/livekit/agent-control-bar/agent-control-bar';
import { useAgentFirstSpeech } from '@/hooks/useAgentFirstSpeech';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../livekit/scroll-area/scroll-area';

const MotionBottom = motion.create('div');

const BOTTOM_VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

interface SessionViewProps {
  appConfig: AppConfig;
  taskType?: 'tache1' | 'tache2' | 'tache3';
}

export const SessionView = ({
  appConfig,
  taskType,
  ...props
}: React.ComponentProps<'section'> & SessionViewProps) => {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const agentHasSpoken = useAgentFirstSpeech();

  const controls: ControlBarControls = {
    leave: true,
    microphone: true,
    chat: appConfig.supportsChatInput,
    camera: appConfig.supportsVideoInput,
    screenShare: appConfig.supportsVideoInput,
  };

  useEffect(() => {
    const lastMessage = messages.at(-1);
    const lastMessageIsLocal = lastMessage?.from?.isLocal === true;

    if (scrollAreaRef.current && lastMessageIsLocal) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section className="bg-background relative z-10 h-full w-full overflow-hidden" {...props}>
      {/* Exam Timer - centered at top */}
      {taskType && (
        <ExamTimer taskType={taskType} isConnected={session.isConnected} />
      )}

      {/* Microphone Status Indicator */}
      {!agentHasSpoken && session.isConnected && (
        <div
          className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-lg px-6 py-3 shadow-lg"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.95)',
            color: 'white',
          }}
        >
          <span className="text-sm font-medium">
            🎤 Veuillez attendre que l&apos;examinateur termine de parler...
          </span>
        </div>
      )}

      {/* Mode Badge */}
      <div
        className="fixed top-4 right-4 z-50 rounded-lg px-4 py-2 shadow-lg"
        style={{
          backgroundColor: 'rgba(220, 38, 38, 0.9)',
          color: 'white',
        }}
      >
        <span className="text-sm font-semibold">📝 Mode Examen</span>
      </div>

      {/* Chat Transcript */}
      <div
        className={cn(
          'fixed inset-0 grid grid-cols-1 grid-rows-1',
          !chatOpen && 'pointer-events-none'
        )}
      >
        <Fade top className="absolute inset-x-4 top-0 h-40" />
        <ScrollArea ref={scrollAreaRef} className="px-4 pt-40 pb-[150px] md:px-6 md:pb-[200px]">
          <ChatTranscript
            hidden={!chatOpen}
            messages={messages}
            className="mx-auto max-w-2xl space-y-3 transition-opacity duration-300 ease-out"
          />
        </ScrollArea>
      </div>

      {/* Tile Layout */}
      <TileLayout chatOpen={chatOpen} />

      {/* Bottom */}
      <MotionBottom
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="fixed inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {appConfig.isPreConnectBufferEnabled && (
          <PreConnectMessage messages={messages} className="pb-4" />
        )}
        <div className="bg-background relative mx-auto max-w-2xl pb-3 md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <AgentControlBar
            controls={controls}
            isConnected={session.isConnected}
            onDisconnect={session.end}
            onChatOpenChange={setChatOpen}
            microphoneShouldBeDisabled={!agentHasSpoken}
          />
        </div>
      </MotionBottom>
    </section>
  );
};
