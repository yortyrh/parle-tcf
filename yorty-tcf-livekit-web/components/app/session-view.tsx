'use client';

import React, { useEffect, useState } from 'react';
import {
  BarVisualizer,
  useLocalParticipant,
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
  const { localParticipant } = useLocalParticipant();
  const { state: agentState, audioTrack: agentAudioTrack } = useVoiceAssistant();
  const { elapsedSeconds } = useSessionTimer();
  const exerciseData = useExerciseData();
  const exerciseImage = useExerciseImage();
  const report = useReportData();
  const sessionEnded = useSessionEnd();
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
      ? 'Section B: présentez l’annonce et défendez votre point de vue (~10 min).'
      : 'Section A: téléphonez pour demander des informations (~5 min).';
  const sessionAnnouncementText = isTefTask ? tefShortAnnouncement : announcementText;
  const showTefSkeleton = isTefTask && (!exerciseImage || !tefTransitionReady);
  const tefBadgeSection =
    taskSectionLabel || (exerciseImage?.section === 'A' ? 'TEF Section A' : 'TEF Section B');
  const tefBadgeType =
    taskTypeLabel || (exerciseImage?.section === 'A' ? "Demande d'informations" : 'Argumentation');

  const isPreparingReport = sessionEnded && !report;

  const controls: ControlBarControls = {
    leave: true,
    microphone: !sessionEnded,
    chat: false,
    camera: false,
    screenShare: false,
  };

  // Couper le micro dès que l'agent signale la fin de session
  useEffect(() => {
    if (sessionEnded) {
      localParticipant.setMicrophoneEnabled(false);
    }
  }, [sessionEnded, localParticipant]);

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
          <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100/60">
            {isPreparingReport && <ReportPreparingBanner />}
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
        isMinimized={isReportMinimized}
        onToggleMinimize={() => setIsReportMinimized(!isReportMinimized)}
      />
    </section>
  );
}
