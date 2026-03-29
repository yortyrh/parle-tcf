'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarVisualizer,
  useLocalParticipant,
  useRoomContext,
  useSessionContext,
  useVoiceAssistant,
} from '@livekit/components-react';
import type { AppConfig, Task } from '@/app-config';
import { TimerDisplay } from '@/components/app/timer-display';
import {
  AgentControlBar,
  type ControlBarControls,
} from '@/components/livekit/agent-control-bar/agent-control-bar';
import {
  useExerciseData,
  useExerciseImage,
  useReportData,
  useSessionEnd,
  useSessionTimer,
} from '@/hooks';
import { cn } from '@/lib/utils';
import { ExerciseImageViewer } from './exercise-image-viewer';
import { ReportButton, ReportPreparingBanner, ReportViewer } from './report-viewer';

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
  const [isReportMinimized, setIsReportMinimized] = useState(true);
  const [tefTransitionReady, setTefTransitionReady] = useState(false);
  const title = exerciseData?.title || selectedTask?.title || 'Tâche';
  const titleParts = title.split(' - ');
  const taskSectionLabel = titleParts[0] || 'Tâche';
  const taskTypeLabel = titleParts[1] || 'Exercice oral';
  const announcementText =
    exerciseData?.description || selectedTask?.description || 'Description de la tâche';
  const isTefTask = selectedTask?.taskType?.startsWith('tef') ?? false;
  const tefShortAnnouncement =
    exerciseImage?.section === 'B' || selectedTask?.taskType === 'tef-section-b'
      ? 'Section B\u00a0: présentez l\u2019annonce et défendez votre point de vue (~10 min).'
      : 'Section A\u00a0: téléphonez pour demander des informations (~5 min).';
  const sessionAnnouncementText = isTefTask ? tefShortAnnouncement : announcementText;
  const showTefSkeleton = isTefTask && (!exerciseImage || !tefTransitionReady);
  const tefBadgeSection =
    taskSectionLabel || (exerciseImage?.section === 'A' ? 'TEF Section A' : 'TEF Section B');
  const tefBadgeType =
    taskTypeLabel || (exerciseImage?.section === 'A' ? "Demande d'informations" : 'Argumentation');

  const isReviewPhase = sessionEnded && !!report;
  const isPreparingReport = sessionEnded && !report;
  const isTache2 = selectedTask?.taskType === 'tache2';
  const showTache2AgentConnecting =
    isTache2 &&
    !sessionEnded &&
    !isPreparingReport &&
    (agentState === 'connecting' || agentState === 'pre-connect-buffering');
  const showTache2MicHint =
    isTache2 && !sessionEnded && !isPreparingReport && !localParticipant.isMicrophoneEnabled;

  const controls: ControlBarControls = {
    leave: true,
    microphone: !sessionEnded || isReviewPhase,
    chat: false,
    camera: false,
    screenShare: false,
  };

  const handleRestart = useCallback(() => {
    archiveAndReset();
    resetSessionEnd();
    resetTimer();
    setIsReportMinimized(true);
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

  // Afficher automatiquement le rapport quand il arrive
  useEffect(() => {
    if (report) {
      setIsReportMinimized(false);
    }
  }, [report]);

  // Garantit un état de transition visible avant l'affichage complet TEF
  useEffect(() => {
    if (!isTefTask) {
      setTefTransitionReady(true);
      return;
    }

    setTefTransitionReady(false);
    const timeout = setTimeout(() => {
      setTefTransitionReady(true);
    }, 900);

    return () => clearTimeout(timeout);
  }, [isTefTask, selectedTask?.taskType]);

  return (
    <section className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-b from-slate-100/70 via-slate-50/40 to-white p-2 sm:p-4">
      {/* Card Container */}
      <div className="border-border/70 bg-card/95 relative flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-solid shadow-xl ring-1 ring-black/5 backdrop-blur transition-all duration-500 sm:rounded-2xl">
        {/* Card Header with Task Info — flex-1 pour TEF (sans transcription) */}
        <div
          className={cn(
            'border-border/70 from-card via-card to-muted/20 flex gap-3 border-b border-solid bg-gradient-to-b p-4 sm:flex-row sm:gap-4 sm:p-5',
            isTefTask ? 'min-h-0 flex-1 items-stretch overflow-y-auto' : 'items-start'
          )}
        >
          {/* Task Information */}
          <div
            className={cn(
              'mx-auto flex max-w-[860px] min-w-0 flex-1 flex-col',
              isTefTask ? 'gap-2.5' : 'gap-4',
              isTefTask && 'min-h-0'
            )}
          >
            {/* Annonce de tâche: visible avant ET pendant l'exercice TEF */}
            {(isTefTask || !exerciseImage) && (
              <div
                className={cn(
                  'relative flex items-center rounded-xl border border-cyan-300/40 bg-cyan-50/70 shadow-sm',
                  isTefTask
                    ? 'min-h-[72px] px-3 py-2 sm:px-4 sm:py-2.5'
                    : 'min-h-[96px] px-4 py-3 sm:px-5 sm:py-4'
                )}
              >
                <p
                  className={cn(
                    'pr-1 font-semibold text-cyan-700',
                    isTefTask
                      ? 'line-clamp-2 text-sm leading-snug sm:text-base'
                      : 'line-clamp-10 text-base leading-relaxed sm:text-lg sm:leading-relaxed'
                  )}
                >
                  {sessionAnnouncementText}
                </p>
              </div>
            )}

            {/* Etat transitoire TEF: squelette pendant chargement de l'exercice */}
            {showTefSkeleton && (
              <div className="border-border/70 bg-card relative flex min-h-[180px] flex-1 animate-pulse flex-col gap-2 overflow-hidden rounded-2xl border p-3 shadow-sm sm:min-h-[240px] sm:p-4">
                <div className="bg-muted h-5 w-36 rounded-md" />
                <div className="bg-muted h-3.5 w-56 rounded-md" />
                <div className="bg-muted/70 mt-1 h-full min-h-[96px] rounded-xl sm:min-h-[132px]" />
                <div className="bg-muted h-4 w-44 rounded-md" />
              </div>
            )}

            {/* Exercise Image (TEF only) — badges passés pour overlay sur l'image */}
            {exerciseImage && !showTefSkeleton && (
              <ExerciseImageViewer
                exerciseImage={exerciseImage}
                badges={{ section: tefBadgeSection, type: tefBadgeType }}
              />
            )}

            {/* ReportButton / preparing banner pour TEF */}
            {exerciseImage &&
              (isPreparingReport ? (
                <ReportPreparingBanner />
              ) : (
                <ReportButton report={report} onExpand={() => setIsReportMinimized(false)} />
              ))}

            {/* Task Labels/Badges — uniquement pour non-TEF (TEF: badges dans ExerciseImageViewer) */}
            {!exerciseImage && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                {/* Bouton du rapport / état de préparation */}
                <ReportButton
                  report={report}
                  isPreparing={isPreparingReport}
                  onExpand={() => setIsReportMinimized(false)}
                />

                {/* Badges à droite */}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-cyan-700 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-cyan-600/30 ring-inset sm:px-2 sm:py-1 sm:text-xs">
                    {taskSectionLabel}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-cyan-600 px-2.5 py-1 text-[11px] font-medium text-white ring-1 ring-cyan-500/30 ring-inset sm:px-2 sm:py-1 sm:text-xs">
                    {taskTypeLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
          {/* Timer Display - Top Right (TCF only; TEF uses footer) */}
          {!exerciseImage && (
            <div className="ml-auto flex items-center">
              <TimerDisplay elapsedSeconds={elapsedSeconds} />
            </div>
          )}
        </div>

        {/* Zone centrale TCF */}
        {!exerciseImage && !isTefTask && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-50 to-slate-100/60 px-4 py-6">
            {isPreparingReport && <ReportPreparingBanner />}
            {isReviewPhase && (
              <div
                role="status"
                className="max-w-md rounded-xl border border-emerald-200/80 bg-emerald-50/95 px-4 py-3 text-center text-emerald-950 shadow-sm"
              >
                <p className="text-sm font-semibold">Phase de discussion</p>
                <p className="mt-1 text-sm text-emerald-900/90">
                  Votre micro est activé. Posez vos questions à l&apos;examinateur pour éclaircir
                  vos doutes sur le rapport et votre évaluation.
                </p>
              </div>
            )}
            {showTache2AgentConnecting && (
              <div
                role="status"
                className="max-w-md rounded-xl border border-sky-200/90 bg-sky-50/95 px-4 py-3 text-center text-sky-950 shadow-sm"
              >
                <p className="text-sm font-semibold">Connexion de l&apos;examinateur</p>
                <p className="mt-1 text-sm text-sky-900/90">
                  L&apos;assistant se connecte : dans quelques instants il vous présentera la
                  consigne à l&apos;oral. Si vous n&apos;entendez rien ensuite, vérifiez le volume
                  et le bouton « Démarrer l&apos;audio » du navigateur.
                </p>
              </div>
            )}
            {showTache2MicHint && (
              <div
                role="status"
                className="max-w-md rounded-xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-center text-amber-950 shadow-sm"
              >
                <p className="text-sm font-semibold">Micro désactivé</p>
                <p className="mt-1 text-sm text-amber-900/90">
                  L&apos;examinateur parle en premier pour expliquer l&apos;exercice ; le micro sert
                  uniquement à ce qu&apos;il vous entende quand vous répondez. Activez-le dans la
                  barre du bas lorsque vous êtes prêt·e à prendre la parole.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Statut TEF déplacé proche des contrôles pour lecture + suivi en même temps */}
        {isTefTask && (
          <div className="border-border/60 border-t bg-slate-50/80 px-3 py-2 sm:px-4">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <div aria-label="Indicateur de ton" className="flex items-center gap-2">
                <div className="bg-background/90 border-input/60 h-8 w-8 rounded-md border shadow-sm sm:h-9 sm:w-9">
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
                <span className="text-muted-foreground text-xs font-medium sm:text-sm">
                  État vocal
                </span>
              </div>
              <div aria-label="Durée de session">
                <TimerDisplay elapsedSeconds={elapsedSeconds} compact />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="border-border/70 border-t border-solid bg-white/95 p-2 sm:p-4 xl:p-6">
          <div className="relative mx-auto max-w-5xl rounded-xl bg-transparent">
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
        previousReports={previousReports}
        isMinimized={isReportMinimized}
        onToggleMinimize={() => setIsReportMinimized(!isReportMinimized)}
        onRestart={handleRestart}
      />
    </section>
  );
}
