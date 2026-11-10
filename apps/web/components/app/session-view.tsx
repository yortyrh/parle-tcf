'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  Headset,
  KeyboardIcon,
  Microphone,
  MicrophoneSlash,
  PhoneDisconnectIcon,
  Shuffle,
  SkipBack,
  SkipForward,
} from '@phosphor-icons/react/dist/ssr';
import type { AppConfig, Task } from '@/app-config';
import { ConsigneTabContent } from '@/components/app/consigne-tab-content';
import { ConversationTabContent } from '@/components/app/conversation-tab-content';
import { SessionStatus } from '@/components/app/session-status';
import { ShortcutsDialog } from '@/components/app/shortcuts-dialog';
import { TimerDisplay } from '@/components/app/timer-display';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCountdown, useSessionShortcuts } from '@/hooks';
import { sessionPhase } from '@/lib/session-phase';
import { cn } from '@/lib/utils';
import { useRealtimeExam } from '@/providers/realtime-exam-provider';

type SessionTab = 'consigne' | 'conversation';

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
  variant = 'default',
  icons = 'none',
  evaluatorCaptionVisible = true,
}: {
  /** Libellé visible (ex. « Vous »). Omis pour l’évaluateur (casque + barres seuls). */
  label?: string;
  active: boolean;
  color: 'cyan' | 'emerald';
  levelRef: React.RefObject<number>;
  variant?: 'default' | 'barsOnly';
  /** Casque à gauche des barres, sans texte — pour le canal agent uniquement. */
  icons?: 'none' | 'evaluator';
  /** Affiche « Évaluateur » à côté des barres (desktop assez haut uniquement). */
  evaluatorCaptionVisible?: boolean;
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

  const barActiveColor = color === 'cyan' ? 'bg-primary' : 'bg-success';
  const barInactiveColor = 'bg-muted-foreground/30';

  const bars = Array.from({ length: BAR_COUNT }, (_, i) => (
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
  ));

  if (variant === 'barsOnly') {
    return (
      <div className="flex h-5 shrink-0 items-center gap-[2px]" aria-hidden>
        {bars}
      </div>
    );
  }

  const iconMuted = 'text-muted-foreground';
  const iconActive = color === 'cyan' ? 'text-primary' : 'text-success';
  const iconClass = cn('h-4 w-4 shrink-0', active ? iconActive : iconMuted);
  const showEvaluatorIcons = icons === 'evaluator' && variant === 'default';

  const evaluatorAriaLabel = active
    ? 'Évaluateur parle — assistant vocal par intelligence artificielle'
    : 'Évaluateur, silence — assistant vocal par intelligence artificielle';

  if (showEvaluatorIcons) {
    return (
      <div
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 transition-all duration-200',
          'border-input bg-background hover:bg-accent hover:text-accent-foreground',
          'dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
          active ? 'text-foreground border-primary/50 bg-primary/10 shadow-sm' : null
        )}
        aria-label={evaluatorAriaLabel}
        role="status"
      >
        <Headset weight="bold" className={iconClass} aria-hidden />
        <div className="flex h-5 items-center gap-[2px]" aria-hidden>
          {bars}
        </div>
        {evaluatorCaptionVisible ? (
          <span
            className={cn(
              'text-xs font-bold tracking-wider whitespace-nowrap uppercase select-none',
              active ? 'text-primary' : 'text-foreground'
            )}
            aria-hidden
          >
            Évaluateur
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all duration-200',
        active
          ? color === 'cyan'
            ? 'border-primary/50 bg-primary/10 shadow-sm'
            : 'border-success/50 bg-success/10 shadow-sm'
          : 'border-border/60 bg-background/80'
      )}
    >
      <div className="flex h-5 items-center gap-[2px]">{bars}</div>
      {label != null && label !== '' ? (
        <span
          className={cn(
            'text-[11px] font-medium tracking-wide transition-colors duration-200 select-none',
            active ? (color === 'cyan' ? 'text-primary' : 'text-success') : 'text-muted-foreground'
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function SessionView({ selectedTask }: SessionViewProps) {
  const exam = useRealtimeExam();
  const { secondsLeft } = useCountdown(exam.timeUpAt, exam.onTimeUp);
  const [sessionTab, setSessionTab] = useState<SessionTab>('consigne');
  const [compactSessionFooter, setCompactSessionFooter] = useState(false);
  const [showEvaluatorFooterCaption, setShowEvaluatorFooterCaption] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const isTache1 = selectedTask?.taskType === 'tache1';
  const isTache2 = selectedTask?.taskType === 'tache2';
  const isTache3 = selectedTask?.taskType === 'tache3';

  const isMicEnabled = !exam.sessionEnded;
  const canUseMicShortcut = isMicEnabled && exam.isConnected;

  const showMicHint = (isTache1 || isTache2 || isTache3) && !exam.sessionEnded && !exam.micEnabled;

  const announcementText =
    exam.exerciseData?.description || selectedTask?.description || 'Description de la tâche';

  const showExerciseSkeleton = !exam.exerciseData && (isTache2 || isTache3);

  const handleRestart = useCallback(() => {
    void exam.restartExam();
  }, [exam]);

  useEffect(() => {
    setSessionTab('consigne');
  }, [exam.restartSequence]);

  /* Intentionally avoid depending on the whole `exam` object (context value) to limit re-runs. */
  useEffect(() => {
    if (exam.sessionEnded) {
      exam.setMicEnabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- granular deps above
  }, [exam.sessionEnded, exam.setMicEnabled]);

  useSessionShortcuts({
    'toggle-mic': () => {
      if (canUseMicShortcut) exam.setMicEnabled(!exam.micEnabled);
    },
    'show-shortcuts': () => setShortcutsOpen(true),
  });

  const phase = sessionPhase({
    preparing: Boolean(exam.preparation),
    isConnecting: exam.isConnecting,
    isConnected: exam.isConnected,
    sessionEnded: exam.sessionEnded,
    agentSpeaking: exam.agentSpeaking,
    userSpeaking: exam.userSpeaking,
    micEnabled: exam.micEnabled,
  });

  useEffect(() => {
    const mqCompact = window.matchMedia('(min-width: 640px) and (max-height: 700px)');
    const mqSm = window.matchMedia('(min-width: 640px)');
    const mqShort = window.matchMedia('(max-height: 700px)');
    const apply = () => {
      setCompactSessionFooter(mqCompact.matches);
      setShowEvaluatorFooterCaption(mqSm.matches && !mqShort.matches);
    };
    apply();
    mqCompact.addEventListener('change', apply);
    mqSm.addEventListener('change', apply);
    mqShort.addEventListener('change', apply);
    return () => {
      mqCompact.removeEventListener('change', apply);
      mqSm.removeEventListener('change', apply);
      mqShort.removeEventListener('change', apply);
    };
  }, []);

  const footerEvaluatorIndicator = (
    <SpeakingIndicator
      active={exam.agentSpeaking}
      color="cyan"
      levelRef={exam.agentAudioLevelRef}
      icons="evaluator"
      evaluatorCaptionVisible={showEvaluatorFooterCaption}
    />
  );

  const footerMicControl = isMicEnabled ? (
    <Button
      variant={exam.micEnabled ? 'primary' : 'outline'}
      size="sm"
      type="button"
      aria-pressed={exam.micEnabled}
      aria-label={exam.micEnabled ? 'Couper le micro (M)' : 'Activer le micro (M)'}
      onClick={() => exam.setMicEnabled(!exam.micEnabled)}
      className="gap-2"
    >
      {exam.micEnabled ? (
        <Microphone weight="bold" className="h-4 w-4" />
      ) : (
        <MicrophoneSlash weight="bold" className="h-4 w-4" />
      )}
      <SpeakingIndicator
        label="Vous"
        active={exam.micEnabled && exam.userSpeaking}
        color="emerald"
        levelRef={exam.userAudioLevelRef}
        variant="barsOnly"
      />
      <span className="hidden sm:inline">{exam.micEnabled ? 'Micro activé' : 'Micro coupé'}</span>
    </Button>
  ) : (
    <SpeakingIndicator
      label="Vous"
      active={exam.micEnabled && exam.userSpeaking}
      color="emerald"
      levelRef={exam.userAudioLevelRef}
    />
  );

  const footerTimer = <TimerDisplay remainingSeconds={secondsLeft ?? 0} compact />;

  const canSwitchExercise =
    exam.orderedExerciseIds.length > 0 && !exam.isConnecting && !exam.isRestarting;

  const footerEndCall = (
    <Button
      variant="destructive"
      type="button"
      onClick={() => exam.end()}
      disabled={!exam.isConnected}
      className="px-3 sm:px-4"
    >
      <PhoneDisconnectIcon weight="bold" className="h-4 w-4 sm:h-5 sm:w-5" />
      <span className="hidden sm:inline">Raccrocher</span>
      <span className="inline sm:hidden">Fin</span>
    </Button>
  );

  return (
    <section className="bg-background relative z-10 flex h-full w-full items-center justify-center overflow-hidden p-2 sm:p-4">
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <div className="bg-card shadow-raised relative flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="font-display truncate text-base sm:text-lg">
              {selectedTask?.title ?? 'Session'}
            </h1>
            <SessionStatus phase={phase} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Raccourcis clavier (?)"
          >
            <KeyboardIcon className="size-5" aria-hidden />
          </Button>
        </div>
        <Tabs
          value={sessionTab}
          onValueChange={(v) => setSessionTab(v as SessionTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex items-end border-b px-3 pt-1.5">
            <TabsList variant="line" className="w-full min-w-0 justify-start gap-0 pb-1.5">
              <TabsTrigger value="consigne" className="min-w-0 flex-1 sm:flex-none sm:px-5">
                Consigne
              </TabsTrigger>
              <TabsTrigger value="conversation" className="min-w-0 flex-1 sm:flex-none sm:px-5">
                Conversation
              </TabsTrigger>
            </TabsList>
          </div>

          <div
            role="toolbar"
            aria-label="Navigation entre les sujets"
            className="bg-muted/40 grid w-full shrink-0 grid-cols-[auto_1fr_auto] items-center border-b px-2 py-1 sm:px-3 sm:py-1"
          >
            <button
              type="button"
              disabled={!canSwitchExercise}
              onClick={() => void exam.goToAnotherExercise('previous')}
              title="Aller à l’exercice précédent"
              aria-label="Aller à l’exercice précédent (ordre de la banque)"
              className={cn(
                'bg-card text-primary inline-flex size-8 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full border shadow-sm transition-colors sm:size-9',
                canSwitchExercise
                  ? 'hover:bg-accent'
                  : 'border-muted text-muted-foreground cursor-not-allowed opacity-50'
              )}
            >
              <SkipBack weight="bold" className="h-4 w-4" />
            </button>
            <div className="flex items-center justify-center gap-4 sm:gap-5">
              <button
                type="button"
                disabled={!canSwitchExercise}
                onClick={() => void exam.goToAnotherExercise('random')}
                title="Autre sujet au hasard"
                aria-label="Autre sujet au hasard"
                className={cn(
                  'bg-card text-primary inline-flex size-8 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full border shadow-sm transition-colors sm:size-9',
                  canSwitchExercise
                    ? 'hover:bg-accent'
                    : 'border-muted text-muted-foreground cursor-not-allowed opacity-50'
                )}
              >
                <Shuffle weight="bold" className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Recommencer la session"
                title="Recommencer la session"
                onClick={handleRestart}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex size-8 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full shadow-sm transition-colors sm:size-9"
              >
                <ArrowCounterClockwise className="h-4 w-4 shrink-0" weight="bold" />
              </button>
            </div>
            <button
              type="button"
              disabled={!canSwitchExercise}
              onClick={() => void exam.goToAnotherExercise('next')}
              title="Aller à l’exercice suivant"
              aria-label="Aller à l’exercice suivant (ordre de la banque)"
              className={cn(
                'bg-card text-primary inline-flex size-8 shrink-0 cursor-pointer touch-manipulation items-center justify-center justify-self-end rounded-full border shadow-sm transition-colors sm:size-9',
                canSwitchExercise
                  ? 'hover:bg-accent'
                  : 'border-muted text-muted-foreground cursor-not-allowed opacity-50'
              )}
            >
              <SkipForward weight="bold" className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <TabsContent
              value="consigne"
              className="mt-0 min-h-0 flex-1 overflow-y-auto p-3 outline-none sm:p-4"
            >
              <ConsigneTabContent
                announcementText={announcementText}
                imageUrl={exam.exerciseData?.imageUrl}
                showExerciseSkeleton={showExerciseSkeleton}
                showMicHint={showMicHint}
              />
            </TabsContent>

            <TabsContent
              value="conversation"
              className="mt-0 min-h-0 flex-1 overflow-y-auto p-3 outline-none sm:p-4"
            >
              <ConversationTabContent lines={exam.transcripts} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="bg-card border-t px-3 py-2 sm:px-4 sm:py-3">
          {compactSessionFooter ? (
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex min-w-0 items-center gap-2">
                {footerEvaluatorIndicator}
                {footerMicControl}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {footerTimer}
                {footerEndCall}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">{footerEvaluatorIndicator}</div>
                {footerTimer}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">{footerMicControl}</div>
                {footerEndCall}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
