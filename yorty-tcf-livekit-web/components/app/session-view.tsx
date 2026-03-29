'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Track } from 'livekit-client';
import remarkGfm from 'remark-gfm';
import {
  BarVisualizer,
  useLocalParticipant,
  useRoomContext,
  useSessionContext,
  useTranscriptions,
  useVoiceAssistant,
} from '@livekit/components-react';
import type { TextStreamData } from '@livekit/components-react';
import {
  ArrowCounterClockwise,
  CircleNotch,
  PhoneDisconnectIcon,
} from '@phosphor-icons/react/dist/ssr';
import type { AppConfig, Task } from '@/app-config';
import { ExerciseImageViewer } from '@/components/app/exercise-image-viewer';
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
import type { ExerciseImageData } from '@/hooks/useExerciseImage';
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
  const isTache2 = selectedTask?.taskType === 'tache2';
  const isReviewPhase = sessionEnded && !!report;
  const isPreparingReport = sessionEnded && !report;
  const isMicEnabled = !sessionEnded || isReviewPhase;
  const canUseMicShortcut = isMicEnabled && session.isConnected && !microphoneToggle.pending;

  const showTache2AgentConnecting =
    isTache2 &&
    !sessionEnded &&
    !isPreparingReport &&
    (agentState === 'connecting' || agentState === 'pre-connect-buffering');

  const showTache2MicHint =
    isTache2 && !sessionEnded && !isPreparingReport && !localParticipant.isMicrophoneEnabled;

  const announcementText =
    exerciseData?.description || selectedTask?.description || 'Description de la tâche';

  const showTefSkeleton = isTefTask && (!exerciseImage || !tefTransitionReady);

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

  // Mute mic when session ends (report is being generated)
  useEffect(() => {
    if (sessionEnded && !report) {
      localParticipant.setMicrophoneEnabled(false);
    }
  }, [sessionEnded, report, localParticipant]);

  // Re-enable mic when the report arrives (review phase)
  useEffect(() => {
    if (isReviewPhase) {
      localParticipant.setMicrophoneEnabled(true);
    }
  }, [isReviewPhase, localParticipant]);

  // Space bar shortcut to toggle mic
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

  // TEF transition delay
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
      {/* Card */}
      <div className="border-border/70 bg-card/95 relative flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-solid shadow-xl ring-1 ring-black/5 backdrop-blur sm:rounded-2xl">
        {/* Tabs */}
        <Tabs defaultValue="consigne" className="flex min-h-0 flex-1 flex-col">
          {/* Tab Bar */}
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

          {/* Consigne */}
          <TabsContent value="consigne" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <ConsigneTabContent
              isTefTask={isTefTask}
              exerciseImage={exerciseImage}
              announcementText={announcementText}
              showTefSkeleton={showTefSkeleton}
              showTache2AgentConnecting={showTache2AgentConnecting}
              showTache2MicHint={showTache2MicHint}
            />
          </TabsContent>

          {/* Conseils */}
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

          {/* Conversation */}
          <TabsContent value="conversation" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <ConversationTabContent
              transcriptions={transcriptions}
              localIdentity={localParticipant.identity}
            />
          </TabsContent>
        </Tabs>

        {/* Bottom Bar */}
        <div className="border-border/70 border-t bg-white/95 px-3 py-2 sm:px-4 sm:py-3">
          {/* Row 1: Agent BarVisualizer left, Timer right */}
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

          {/* Row 2: Mic selector left, FIN button right */}
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

/* ─── Consigne Tab ─── */

interface ConsigneTabContentProps {
  isTefTask: boolean;
  exerciseImage: ExerciseImageData | null;
  announcementText: string;
  showTefSkeleton: boolean;
  showTache2AgentConnecting: boolean;
  showTache2MicHint: boolean;
}

function ConsigneTabContent({
  isTefTask,
  exerciseImage,
  announcementText,
  showTefSkeleton,
  showTache2AgentConnecting,
  showTache2MicHint,
}: ConsigneTabContentProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* TCF: announcement text */}
      {!isTefTask && (
        <div className="relative flex min-h-[80px] items-start rounded-xl border border-cyan-300/40 bg-cyan-50/70 px-4 py-3 shadow-sm">
          <p className="text-base leading-relaxed font-semibold text-cyan-700">
            {announcementText}
          </p>
        </div>
      )}

      {/* TEF: loading skeleton */}
      {showTefSkeleton && (
        <div className="border-border/70 bg-card relative flex min-h-[200px] flex-1 animate-pulse flex-col gap-2 overflow-hidden rounded-2xl border p-3 shadow-sm sm:p-4">
          <div className="bg-muted h-5 w-36 rounded-md" />
          <div className="bg-muted h-3.5 w-56 rounded-md" />
          <div className="bg-muted/70 mt-1 h-full min-h-[120px] rounded-xl sm:min-h-[160px]" />
          <div className="bg-muted h-4 w-44 rounded-md" />
        </div>
      )}

      {/* TEF: exercise image */}
      {exerciseImage && !showTefSkeleton && <ExerciseImageViewer exerciseImage={exerciseImage} />}

      {/* Tache 2: agent connecting hint */}
      {showTache2AgentConnecting && (
        <div
          role="status"
          className="rounded-xl border border-sky-200/90 bg-sky-50/95 px-4 py-3 text-center text-sky-950 shadow-sm"
        >
          <p className="text-sm font-semibold">Connexion de l&apos;examinateur</p>
          <p className="mt-1 text-sm text-sky-900/90">
            L&apos;assistant se connecte : dans quelques instants il vous présentera la consigne à
            l&apos;oral. Si vous n&apos;entendez rien ensuite, vérifiez le volume et le bouton «
            Démarrer l&apos;audio » du navigateur.
          </p>
        </div>
      )}

      {/* Tache 2: mic off hint */}
      {showTache2MicHint && (
        <div
          role="status"
          className="rounded-xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-center text-amber-950 shadow-sm"
        >
          <p className="text-sm font-semibold">Micro désactivé</p>
          <p className="mt-1 text-sm text-amber-900/90">
            L&apos;examinateur parle en premier pour expliquer l&apos;exercice ; le micro sert
            uniquement à ce qu&apos;il vous entende quand vous répondez. Activez-le dans la barre du
            bas lorsque vous êtes prêt·e à prendre la parole.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Conseils Tab ─── */

interface ConseilsTabContentProps {
  report: string | null;
  previousReports: string[];
  isPreparingReport: boolean;
  isReviewPhase: boolean;
  viewingPreviousIndex: number | null;
  onSetViewingPreviousIndex: (index: number | null) => void;
}

function ConseilsTabContent({
  report,
  previousReports,
  isPreparingReport,
  isReviewPhase,
  viewingPreviousIndex,
  onSetViewingPreviousIndex,
}: ConseilsTabContentProps) {
  // When there's no current report but previous ones exist (e.g. after restart),
  // fall back to showing the most recent previous report.
  const fallbackReport =
    !report && previousReports.length > 0 ? previousReports[previousReports.length - 1] : null;

  const activeReport = report ?? fallbackReport;
  const isFallback = !report && !!fallbackReport;

  const displayedReport =
    viewingPreviousIndex !== null ? previousReports[viewingPreviousIndex] : activeReport;
  const isViewingPrevious = viewingPreviousIndex !== null;

  const showPreviousButtons = !isViewingPrevious && previousReports.length > (isFallback ? 1 : 0);

  const showTopBar = isViewingPrevious || showPreviousButtons;

  const topBar = showTopBar ? (
    <div className="sticky top-0 z-10 -mx-3 flex items-center gap-1.5 border-b border-gray-100 bg-white px-3 py-2 sm:-mx-4 sm:px-4">
      {isViewingPrevious ? (
        <>
          <button
            onClick={() => onSetViewingPreviousIndex(null)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-cyan-700 ring-1 ring-cyan-300/50 transition-colors hover:bg-cyan-50"
          >
            ← Retour
          </button>
          <span className="text-muted-foreground text-xs">Essai {viewingPreviousIndex! + 1}</span>
        </>
      ) : (
        previousReports
          .slice(0, isFallback ? previousReports.length - 1 : previousReports.length)
          .map((_, index) => (
            <button
              key={index}
              onClick={() => onSetViewingPreviousIndex(index)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
            >
              Essai {index + 1}
            </button>
          ))
      )}
    </div>
  ) : null;

  if (isPreparingReport) {
    return (
      <div className="flex flex-col gap-4">
        {topBar}
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-100/50">
            <CircleNotch size={28} weight="bold" className="animate-spin text-amber-600" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-amber-900">
              Rapport en cours de préparation
            </p>
            <p className="mt-1 text-sm text-amber-700/80">
              Veuillez patienter, votre rapport détaillé arrive dans quelques instants.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!activeReport) {
    return (
      <div className="flex flex-col gap-4">
        {topBar}
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-muted-foreground text-sm">Aucun rapport disponible pour le moment.</p>
          <p className="text-muted-foreground/70 text-xs">
            Le rapport apparaîtra ici à la fin de la session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {topBar}

      {/* Banner: phase de discussion (only when there's a live current report) */}
      {isReviewPhase && !isFallback && !isViewingPrevious && (
        <div
          role="status"
          className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/95 px-4 py-3 text-center text-emerald-950 shadow-sm"
        >
          <p className="text-sm font-semibold">Phase de discussion</p>
          <p className="mt-1 text-sm text-emerald-900/90">
            Votre micro est activé. Posez vos questions à l&apos;examinateur pour éclaircir vos
            doutes sur le rapport et votre évaluation.
          </p>
        </div>
      )}

      {/* Banner: affichage du rapport précédent après un recommencement */}
      {isFallback && !isViewingPrevious && (
        <div
          role="status"
          className="rounded-xl border border-sky-200/80 bg-sky-50/95 px-3 py-2 text-sky-900 shadow-sm"
        >
          <p className="text-xs">
            Rapport de l&apos;essai précédent — un nouveau rapport sera disponible à la fin de cette
            session.
          </p>
        </div>
      )}

      {/* Report markdown */}
      <div className="prose prose-cyan prose-headings:text-cyan-800 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:font-semibold prose-strong:text-gray-900 prose-ul:text-gray-700 prose-li:leading-relaxed max-w-none text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayedReport ?? ''}</ReactMarkdown>
      </div>
    </div>
  );
}

/* ─── Conversation Tab ─── */

interface ConversationTabContentProps {
  transcriptions: TextStreamData[];
  localIdentity: string;
}

function ConversationTabContent({ transcriptions, localIdentity }: ConversationTabContentProps) {
  const sorted = [...transcriptions].sort(
    (a, b) => a.streamInfo.timestamp - b.streamInfo.timestamp
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptions]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="text-muted-foreground text-sm">Aucune conversation pour le moment.</p>
        <p className="text-muted-foreground/70 text-xs">
          La transcription de la conversation apparaîtra ici.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((item) => {
        const isLocal = item.participantInfo.identity === localIdentity;
        const label = isLocal ? 'Vous' : 'Évaluateur';

        return (
          <div
            key={item.streamInfo.id}
            className={cn('flex gap-2', isLocal ? 'flex-row-reverse' : 'flex-row')}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                isLocal ? 'bg-cyan-700 text-white' : 'bg-teal-600 text-white'
              )}
            >
              {label[0]}
            </div>

            {/* Bubble */}
            <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5', isLocal && 'items-end')}>
              <span className="text-muted-foreground text-xs font-semibold">{label}</span>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug',
                  isLocal
                    ? 'rounded-tr-none bg-cyan-700 text-white'
                    : 'rounded-tl-none bg-gray-100 text-gray-900'
                )}
              >
                {item.text}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
