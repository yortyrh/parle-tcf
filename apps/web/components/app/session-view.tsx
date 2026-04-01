'use client';

import { useCallback, useEffect, useState } from 'react';
import { Track } from 'livekit-client';
import {
  BarVisualizer,
  useLocalParticipant,
  useRoomContext,
  useSessionContext,
  useTranscriptions,
  useVoiceAssistant,
} from '@livekit/components-react';
import { ArrowCounterClockwise, PhoneDisconnectIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig, Task } from '@/app-config';
import { ConseilsTabContent } from '@/components/app/conseils-tab-content';
import { ConsigneTabContent } from '@/components/app/consigne-tab-content';
import { ConversationTabContent } from '@/components/app/conversation-tab-content';
import { TimerDisplay } from '@/components/app/timer-display';
import { useInputControls } from '@/components/livekit/agent-control-bar/hooks/use-input-controls';
import { TrackSelector } from '@/components/livekit/agent-control-bar/track-selector';
import { Button } from '@/components/livekit/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useExerciseData,
  useExerciseImage,
  useReportData,
  useSessionEnd,
  useSessionTimer,
} from '@/hooks';
import { cn } from '@/lib/utils';

interface SessionViewProps {
  appConfig: AppConfig;
  selectedTask: Task | null;
}

export function SessionView({ selectedTask }: SessionViewProps) {
  const session = useSessionContext();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { state: agentState, audioTrack: agentAudioTrack } = useVoiceAssistant();
  const { elapsedSeconds, resetTimer } = useSessionTimer();
  const exerciseData = useExerciseData();
  const exerciseImage = useExerciseImage();
  const { report, previousReports, archiveAndReset } = useReportData();
  const { sessionEnded, resetSessionEnd } = useSessionEnd();
  const transcriptions = useTranscriptions();
  const [tefTransitionReady, setTefTransitionReady] = useState(false);
  const [viewingPreviousIndex, setViewingPreviousIndex] = useState<number | null>(null);

  const {
    micTrackRef,
    microphoneToggle,
    handleAudioDeviceChange,
    handleMicrophoneDeviceSelectError,
  } = useInputControls({ saveUserChoices: true });

  const isTefTask = selectedTask?.taskType?.startsWith('tef') ?? false;
  const isTache1 = selectedTask?.taskType === 'tache1';
  const isTache2 = selectedTask?.taskType === 'tache2';
  const isTache3 = selectedTask?.taskType === 'tache3';
  const isReviewPhase = sessionEnded && !!report;
  const isPreparingReport = sessionEnded && !report;
  const isMicEnabled = !sessionEnded || isReviewPhase;
  const canUseMicShortcut = isMicEnabled && session.isConnected && !microphoneToggle.pending;

  const showMicHint =
    (isTache1 || isTache2 || isTache3) &&
    !sessionEnded &&
    !isPreparingReport &&
    !localParticipant.isMicrophoneEnabled;

  const announcementText =
    exerciseData?.description || selectedTask?.description || 'Description de la tâche';

  const showTefSkeleton = isTefTask && (!exerciseImage || !tefTransitionReady);
  const showExerciseSkeleton = !exerciseData && (isTache2 || isTache3);

  const handleRestart = useCallback(() => {
    archiveAndReset();
    resetSessionEnd();
    resetTimer();
    setViewingPreviousIndex(null);
    localParticipant.setMicrophoneEnabled(false);

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify({ type: 'restart_test' }));
    room.localParticipant.publishData(data, { reliable: true });
  }, [archiveAndReset, resetSessionEnd, resetTimer, localParticipant, room]);

  useEffect(() => {
    if (sessionEnded && !report) {
      localParticipant.setMicrophoneEnabled(false);
    }
  }, [sessionEnded, report, localParticipant]);

  useEffect(() => {
    if (isReviewPhase) {
      localParticipant.setMicrophoneEnabled(true);
    }
  }, [isReviewPhase, localParticipant]);

  useEffect(() => {
    if (!canUseMicShortcut) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target.isContentEditable) return;
      }
      event.preventDefault();
      void microphoneToggle.toggle();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUseMicShortcut, microphoneToggle]);

  useEffect(() => {
    if (!isTefTask) {
      setTefTransitionReady(true);
      return;
    }
    setTefTransitionReady(false);
    const timeout = setTimeout(() => setTefTransitionReady(true), 900);
    return () => clearTimeout(timeout);
  }, [isTefTask, selectedTask?.taskType]);

  return (
    <section className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b from-slate-100/70 via-slate-50/40 to-white p-2 sm:p-4">
      <div className="border-border/70 bg-card/95 relative flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-solid shadow-xl ring-1 ring-black/5 backdrop-blur sm:rounded-2xl">
        <Tabs defaultValue="consigne" className="flex min-h-0 flex-1 flex-col">
          <div className="border-border/70 flex items-end border-b bg-white/60 px-3 pt-2">
            <TabsList variant="line" className="min-w-0 flex-1 justify-start gap-0">
              <TabsTrigger value="consigne" className="flex-1 sm:flex-none sm:px-5">
                Consigne
              </TabsTrigger>
              <TabsTrigger value="conseils" className="flex-1 sm:flex-none sm:px-5">
                Conseils
              </TabsTrigger>
              <TabsTrigger value="conversation" className="flex-1 sm:flex-none sm:px-5">
                Conversation
              </TabsTrigger>
            </TabsList>
            <button
              onClick={handleRestart}
              className="mb-1.5 ml-2 inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-cyan-700"
            >
              <ArrowCounterClockwise size={14} weight="bold" />
              <span className="hidden sm:inline">Recommencer</span>
            </button>
          </div>

          <TabsContent value="consigne" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <ConsigneTabContent
              isTefTask={isTefTask}
              exerciseImage={exerciseImage}
              announcementText={announcementText}
              showTefSkeleton={showTefSkeleton}
              showExerciseSkeleton={showExerciseSkeleton}
              showMicHint={showMicHint}
            />
          </TabsContent>

          <TabsContent
            value="conseils"
            className="min-h-0 flex-1 overflow-y-auto px-3 pt-0 pb-3 sm:px-4 sm:pb-4"
          >
            <ConseilsTabContent
              report={report}
              previousReports={previousReports}
              isPreparingReport={isPreparingReport}
              isReviewPhase={isReviewPhase}
              viewingPreviousIndex={viewingPreviousIndex}
              onSetViewingPreviousIndex={setViewingPreviousIndex}
            />
          </TabsContent>

          <TabsContent value="conversation" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <ConversationTabContent
              transcriptions={transcriptions}
              localIdentity={localParticipant.identity}
            />
          </TabsContent>
        </Tabs>

        <div className="border-border/70 border-t bg-white/95 px-3 py-2 sm:px-4 sm:py-3">
          <div className="mb-2 flex items-center justify-between">
            <div aria-label="Indicateur vocal de l'évaluateur" className="flex items-center gap-2">
              <div className="bg-background/90 border-input/60 h-9 w-16 rounded-md border shadow-sm">
                <BarVisualizer
                  barCount={5}
                  state={agentState}
                  options={{ minHeight: 3 }}
                  trackRef={agentAudioTrack}
                  className="flex h-full items-center justify-center gap-0.5 px-1"
                >
                  <span
                    className={cn(
                      'bg-muted min-h-1.5 w-1.5 rounded-full',
                      'origin-center transition-colors duration-250 ease-linear',
                      'data-[lk-highlighted=true]:bg-foreground data-[lk-muted=true]:bg-muted'
                    )}
                  />
                </BarVisualizer>
              </div>
            </div>
            <TimerDisplay elapsedSeconds={elapsedSeconds} compact />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              {isMicEnabled && (
                <TrackSelector
                  kind="audioinput"
                  aria-label="Microphone"
                  source={Track.Source.Microphone}
                  pressed={microphoneToggle.enabled}
                  disabled={microphoneToggle.pending}
                  audioTrackRef={micTrackRef}
                  onPressedChange={microphoneToggle.toggle}
                  onMediaDeviceError={handleMicrophoneDeviceSelectError}
                  onActiveDeviceChange={handleAudioDeviceChange}
                />
              )}
            </div>
            <Button
              variant="destructive"
              onClick={session.end}
              disabled={!session.isConnected}
              className="px-3 font-mono text-xs sm:px-4 sm:text-sm"
            >
              <PhoneDisconnectIcon weight="bold" className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">END CALL</span>
              <span className="inline sm:hidden">FIN</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
