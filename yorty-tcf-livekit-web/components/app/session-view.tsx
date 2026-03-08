'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BarVisualizer,
  useSessionContext,
  useSessionMessages,
  useVoiceAssistant,
} from '@livekit/components-react';
import type { AppConfig, Task } from '@/app-config';
import { ChatTranscript } from '@/components/app/chat-transcript';
import { TimerDisplay } from '@/components/app/timer-display';
import {
  AgentControlBar,
  type ControlBarControls,
} from '@/components/livekit/agent-control-bar/agent-control-bar';
import { useExerciseData, useExerciseImage, useReportData, useTimerControls } from '@/hooks';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../livekit/scroll-area/scroll-area';
import { ExerciseImageViewer } from './exercise-image-viewer';
import { ReportButton, ReportViewer } from './report-viewer';

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
  const { state: agentState, audioTrack: agentAudioTrack } = useVoiceAssistant();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { timerState } = useTimerControls();
  const exerciseData = useExerciseData();
  const exerciseImage = useExerciseImage();
  const report = useReportData();
  const [isReportMinimized, setIsReportMinimized] = useState(true);

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

  // Afficher automatiquement le rapport quand il arrive
  useEffect(() => {
    if (report) {
      setIsReportMinimized(false);
    }
  }, [report]);

  return (
    <section className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden p-2 sm:p-4">
      {/* Card Container */}
      <div className="border-border bg-card relative flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-solid shadow-lg transition-all duration-500 sm:rounded-2xl">
        {/* Indicateur de ton TEF — petit, toujours visible, en haut à gauche */}
        {exerciseImage && (
          <div
            className="absolute top-1.5 left-1.5 z-20 flex items-center justify-center sm:top-2 sm:left-2"
            aria-label="Indicateur de ton"
          >
            <div
              className={cn(
                'bg-background aspect-square rounded border transition-all duration-300',
                'border-input/50 h-7 w-7 drop-shadow-sm sm:h-8 sm:w-8'
              )}
            >
              <BarVisualizer
                barCount={4}
                state={agentState}
                options={{ minHeight: 3 }}
                trackRef={agentAudioTrack}
                className="flex h-full items-center justify-center gap-0.5"
              >
                <span
                  className={cn(
                    'bg-muted min-h-1.5 w-1.5 rounded-full sm:min-h-2 sm:w-2',
                    'origin-center transition-colors duration-250 ease-linear',
                    'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted'
                  )}
                />
              </BarVisualizer>
            </div>
          </div>
        )}

        {/* Indicateur de temps TEF — en haut à droite, toujours visible */}
        {exerciseImage && (
          <div
            className="absolute top-1.5 right-1.5 z-20 sm:top-2 sm:right-2"
            aria-label="Temps restant"
          >
            {timerState.type && timerState.isRunning ? (
              <TimerDisplay timerState={timerState} compact hideLabel />
            ) : (
              <div className="border-primary/20 rounded border bg-white/90 px-2 py-1 shadow-sm sm:px-2.5 sm:py-1.5">
                <span className="text-muted-foreground font-mono text-sm font-bold tabular-nums sm:text-base">
                  --:--
                </span>
              </div>
            )}
          </div>
        )}

        {/* Card Header with Task Info — flex-1 pour TEF (sans transcription) */}
        <div
          className={cn(
            'border-border flex gap-3 border-b border-solid p-4 sm:flex-row sm:gap-4',
            exerciseImage ? 'min-h-0 flex-1 items-stretch overflow-y-auto' : 'items-start'
          )}
        >
          {/* Task Information */}
          <div
            className={cn(
              'mx-auto flex max-w-[860px] min-w-0 flex-1 flex-col gap-4',
              exerciseImage && 'min-h-0'
            )}
          >
            {/* Description — masquée pour TEF (la consigne est dans ExerciseImageViewer) */}
            {!exerciseImage && (
              <div className="flex min-h-[90px] items-center rounded-lg border-l-4 border-blue-500 bg-blue-50/50 px-4 py-3 shadow-md sm:px-5 sm:py-4">
                <p className="line-clamp-10 text-base leading-relaxed font-semibold text-cyan-600 sm:text-lg sm:leading-relaxed">
                  {exerciseData?.description ||
                    selectedTask?.description ||
                    'Description de la tâche'}
                </p>
              </div>
            )}

            {/* Exercise Image (TEF only) — badges passés pour overlay sur l'image */}
            <ExerciseImageViewer
              exerciseImage={exerciseImage}
              badges={
                exerciseImage
                  ? (() => {
                      const title = exerciseData?.title || selectedTask?.title || 'Tâche';
                      const parts = title.split(' - ');
                      const section =
                        parts[0] ||
                        (exerciseImage.section === 'A' ? 'TEF Section A' : 'TEF Section B');
                      const type =
                        parts[1] ||
                        (exerciseImage.section === 'A'
                          ? "Demande d'informations"
                          : 'Argumentation');
                      return { section, type };
                    })()
                  : undefined
              }
            />

            {/* ReportButton pour TEF — visible quand rapport disponible */}
            {exerciseImage && (
              <ReportButton report={report} onExpand={() => setIsReportMinimized(false)} />
            )}

            {/* Task Labels/Badges — uniquement pour non-TEF (TEF: badges dans ExerciseImageViewer) */}
            {!exerciseImage && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                {/* Bouton du rapport à gauche */}
                <ReportButton report={report} onExpand={() => setIsReportMinimized(false)} />

                {/* Badges à droite */}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {(() => {
                    const title = exerciseData?.title || selectedTask?.title || 'Tâche';
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
            )}
          </div>
          {/* Timer Display - Top Right (TCF uniquement ; TEF : affiché en position absolue) */}
          {!exerciseImage && timerState.type && timerState.isRunning && (
            <div className="ml-auto flex items-center">
              <TimerDisplay timerState={timerState} />
            </div>
          )}
        </div>

        {/* Chat Transcript Area — masqué pour TEF (seulement pour TCF) */}
        {!exerciseImage && (
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
        )}

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

      {/* Report Viewer */}
      <ReportViewer
        report={report}
        isMinimized={isReportMinimized}
        onToggleMinimize={() => setIsReportMinimized(!isReportMinimized)}
      />
    </section>
  );
}
