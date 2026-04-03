'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnectIcon,
} from '@phosphor-icons/react/dist/ssr';
import type { ExerciseImagePayload } from '@yorty-tcf/shared';
import type { AppConfig, Task } from '@/app-config';
import { ConseilsTabContent } from '@/components/app/conseils-tab-content';
import { ConsigneTabContent } from '@/components/app/consigne-tab-content';
import { ConversationTabContent } from '@/components/app/conversation-tab-content';
import { TimerDisplay } from '@/components/app/timer-display';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSessionTimer } from '@/hooks';
import { cn } from '@/lib/utils';
import { useRealtimeExam } from '@/providers/realtime-exam-provider';
import type { ExerciseImageData } from '@/types/exercise-image';

function mapExerciseImage(img: ExerciseImagePayload | null): ExerciseImageData | null {
  if (!img) return null;
  return {
    id: img.id ?? null,
    filename: img.filename,
    section: img.section,
    annonce: img.annonce ?? null,
    title: img.title ?? null,
    consigne: img.consigne ?? null,
    generatedImagePath: img.generatedImagePath ?? null,
    generatedImagePaths: img.generatedImagePaths ?? null,
  };
}

interface SessionViewProps {
  appConfig: AppConfig;
  selectedTask: Task | null;
}

const BAR_COUNT = 5;
const BAR_WEIGHTS = [0.5, 0.8, 1, 0.85, 0.55];
const MIN_H_IDLE = 18;
const MIN_H_ACTIVE = 30;
const SMOOTHING = 0.65;

function SpeakingIndicator({
  label,
  active,
  color,
  levelRef,
}: {
  label: string;
  active: boolean;
  color: 'cyan' | 'emerald';
  levelRef: React.RefObject<number>;
}) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const smoothedRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      smoothedRef.current = 0;
      for (const bar of barsRef.current) {
        if (bar) bar.style.height = `${MIN_H_IDLE}%`;
      }
      return;
    }

    const animate = () => {
      const raw = levelRef.current ?? 0;
      smoothedRef.current = smoothedRef.current * SMOOTHING + raw * (1 - SMOOTHING);
      const level = smoothedRef.current;

      for (let i = 0; i < BAR_COUNT; i++) {
        const bar = barsRef.current[i];
        if (!bar) continue;
        const h = Math.max(MIN_H_ACTIVE, level * BAR_WEIGHTS[i] * 100);
        bar.style.height = `${Math.min(h, 100)}%`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [active, levelRef]);

  const barActiveColor = color === 'cyan' ? 'bg-cyan-500' : 'bg-emerald-500';
  const barInactiveColor = 'bg-muted-foreground/30';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-2.5 py-1 transition-all duration-200',
        active
          ? color === 'cyan'
            ? 'border-cyan-400 bg-cyan-50 shadow-sm shadow-cyan-200/50'
            : 'border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-200/50'
          : 'border-border/60 bg-background/80'
      )}
    >
      <div className="flex h-5 items-center gap-[2px]">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className={cn(
              'block w-[3px] rounded-full transition-colors duration-150',
              active ? barActiveColor : barInactiveColor
            )}
            style={{ height: `${MIN_H_IDLE}%`, minHeight: '3px' }}
          />
        ))}
      </div>
      <span
        className={cn(
          'text-[11px] font-medium tracking-wide transition-colors duration-200 select-none',
          active
            ? color === 'cyan'
              ? 'text-cyan-700'
              : 'text-emerald-700'
            : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function SessionView({ selectedTask }: SessionViewProps) {
  const exam = useRealtimeExam();
  const { elapsedSeconds, resetTimer } = useSessionTimer();
  const [tefTransitionReady, setTefTransitionReady] = useState(false);
  const [viewingPreviousIndex, setViewingPreviousIndex] = useState<number | null>(null);

  const exerciseImage = useMemo(() => mapExerciseImage(exam.exerciseImage), [exam.exerciseImage]);

  const isTefTask = selectedTask?.taskType?.startsWith('tef') ?? false;
  const isTache1 = selectedTask?.taskType === 'tache1';
  const isTache2 = selectedTask?.taskType === 'tache2';
  const isTache3 = selectedTask?.taskType === 'tache3';

  const displayReport = exam.report ?? exam.reportStreaming;
  const isReviewPhase = exam.sessionEnded && !!exam.report;
  const isPreparingReport = exam.sessionEnded && !exam.report && !exam.reportStreaming;
  const isMicEnabled = !exam.sessionEnded || isReviewPhase;
  const canUseMicShortcut = isMicEnabled && exam.isConnected;

  const showMicHint =
    (isTache1 || isTache2 || isTache3) &&
    !exam.sessionEnded &&
    !isPreparingReport &&
    !exam.micEnabled;

  const announcementText =
    exam.exerciseData?.description || selectedTask?.description || 'Description de la tâche';

  const showTefSkeleton = isTefTask && (!exerciseImage || !tefTransitionReady);
  const showExerciseSkeleton = !exam.exerciseData && (isTache2 || isTache3);

  const handleRestart = useCallback(() => {
    void exam.restartExam();
  }, [exam]);

  useEffect(() => {
    resetTimer();
    setViewingPreviousIndex(null);
  }, [exam.restartSequence, resetTimer]);

  /* Intentionally avoid depending on the whole `exam` object (context value) to limit re-runs. */
  useEffect(() => {
    if (exam.sessionEnded && !exam.report) {
      exam.setMicEnabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- granular deps above
  }, [exam.sessionEnded, exam.report, exam.setMicEnabled]);

  useEffect(() => {
    if (isReviewPhase) {
      exam.setMicEnabled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- granular deps above
  }, [isReviewPhase, exam.setMicEnabled]);

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
      exam.setMicEnabled(!exam.micEnabled);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUseMicShortcut, exam]);

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
              type="button"
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
              report={displayReport}
              previousReports={exam.previousReports}
              isPreparingReport={isPreparingReport}
              isReviewPhase={isReviewPhase}
              viewingPreviousIndex={viewingPreviousIndex}
              onSetViewingPreviousIndex={setViewingPreviousIndex}
            />
          </TabsContent>

          <TabsContent value="conversation" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <ConversationTabContent lines={exam.transcripts} />
          </TabsContent>
        </Tabs>

        <div className="border-border/70 border-t bg-white/95 px-3 py-2 sm:px-4 sm:py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SpeakingIndicator
                label="Évaluateur"
                active={exam.agentSpeaking}
                color="cyan"
                levelRef={exam.agentAudioLevelRef}
              />
              <SpeakingIndicator
                label="Vous"
                active={exam.micEnabled && exam.userSpeaking}
                color="emerald"
                levelRef={exam.userAudioLevelRef}
              />
            </div>
            <TimerDisplay elapsedSeconds={elapsedSeconds} compact />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div>
              {isMicEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  aria-label={exam.micEnabled ? 'Couper le micro' : 'Activer le micro'}
                  onClick={() => exam.setMicEnabled(!exam.micEnabled)}
                  className="gap-2"
                >
                  {exam.micEnabled ? (
                    <Microphone weight="bold" className="h-4 w-4" />
                  ) : (
                    <MicrophoneSlash weight="bold" className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {exam.micEnabled ? 'Micro on' : 'Micro off'}
                  </span>
                </Button>
              )}
            </div>
            <Button
              variant="destructive"
              type="button"
              onClick={() => exam.end()}
              disabled={!exam.isConnected}
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
