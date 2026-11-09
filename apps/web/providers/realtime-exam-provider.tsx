'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { z } from 'zod';
import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  type RealtimeItem,
  RealtimeSession,
  type TransportEvent,
  tool,
} from '@openai/agents/realtime';
import type { AttemptMode, ExerciseData, TaskType, TranscriptLine } from '@parle-tcf/shared';
import { TASK_DURATIONS, TCF_TASK_TYPES } from '@parle-tcf/shared';
import { toastAlert } from '@/components/ui/alert-toast';
import { ApiError, api } from '@/lib/api';
import {
  nextExerciseIdRandom,
  nextExerciseIdSequential,
  previousExerciseIdSequential,
} from '@/lib/next-exercise-id';
import { extractPartialReportFromToolArgs } from '@/lib/report-stream';
import { type ExamTranscriptLine, transcriptLinesFromHistory } from '@/lib/transcript-from-history';
import { mergeStreamingAssistantText, pruneStreamBuffer } from '@/lib/transcript-merge';

function messageFromSessionError(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const inner = (payload as { error: unknown }).error;
    if (inner instanceof Error) return inner.message;
    if (typeof inner === 'string') return inner;
  }
  if (payload instanceof Error) return payload.message;
  if (typeof payload === 'string') return payload;
  return 'Erreur Realtime';
}

/** How often the transcript is saved while a task is running. */
const CHECKPOINT_DEBOUNCE_MS = 10_000;
/** Grace period given to the examiner to say goodbye once time is up. */
const TIME_UP_GRACE_MS = 10_000;

const TIME_UP_MESSAGE =
  "Le temps imparti pour cette tâche est écoulé. Remercie brièvement le candidat et clos l'épreuve en une phrase, sans poser de nouvelle question.";

/** Candidate/examiner lines in the shape the API stores (index = seq). */
export function toApiLines(lines: ExamTranscriptLine[]): TranscriptLine[] {
  const out: TranscriptLine[] = [];
  lines.forEach((line, seq) => {
    const text = line.text.trim();
    if (!text) return;
    out.push({ seq, speaker: line.isLocal ? 'candidate' : 'examiner', text });
  });
  return out;
}

function syncExerciseUrl(taskType: string, exerciseId?: string): void {
  if (!(TCF_TASK_TYPES as readonly string[]).includes(taskType)) return;
  const segments = ['/tcf', taskType];
  if (exerciseId) segments.push(exerciseId);
  const newUrl = segments.join('/');
  if (typeof window === 'undefined' || window.location.pathname === newUrl) return;
  window.history.replaceState(null, '', newUrl);
}

const FIN_SESSION_NEXT =
  "CHANGEMENT DE RÔLE — L'examen est terminé. Tu es maintenant un coach/professeur bienveillant. Étape obligatoire : appelle l'outil envoiRapport avec le rapport markdown complet (points forts, points à améliorer, exemples de reformulation). Ensuite, aide le candidat à comprendre ses erreurs. Sois généreux en explications mais concis — pose des questions au candidat pour qu'il reste le protagoniste.";

const ENVOI_RAPPORT_NEXT =
  'Le rapport a été envoyé. Le micro du candidat sera réactivé automatiquement. Restez disponible pour répondre aux questions du candidat sur le rapport et son évaluation.';

const RECOMMENCER_TEST_NEXT =
  "L'épreuve a été réinitialisée. Recommence immédiatement comme examinateur au tout début : suis exactement la consigne d'accueil initiale, sans résumer la tentative précédente.";

export interface StartOptions {
  mode?: AttemptMode;
  /** Run to attach to when chaining the three tasks of a full exam. */
  runId?: string;
}

export interface PreparationState {
  secondsLeft: number;
}

export interface RealtimeExamContextValue {
  /** Persisted attempt of the running task. */
  attemptId: string | null;
  runId: string | null;
  mode: AttemptMode;
  /** True once the user has no provider key: the UI should send them to the settings. */
  needsProviderKey: boolean;
  /** Pre-task preparation countdown (tâche 2), null otherwise. */
  preparation: PreparationState | null;
  skipPreparation: () => void;
  /** Seconds left on the speaking timer; null before the task starts. */
  timeUpAt: number | null;
  /** True once the attempt has been saved as completed (task over). */
  attemptCompleted: boolean;
  /** Called by the countdown at 0: closes the task in exam mode, only warns in practice. */
  onTimeUp: () => void;
  /** Saves the attempt, stops the session and keeps the result screen state. */
  finishTask: () => Promise<void>;
  isConnected: boolean;
  isConnecting: boolean;
  isRestarting: boolean;
  fatalError: string | null;
  /** Erreur session/outil (ex. échec d’envoi du rapport) — affichée à la place du loader infini */
  reportDeliveryError: string | null;
  start: (taskType: string, exerciseId?: string, options?: StartOptions) => Promise<void>;
  end: () => void;
  micEnabled: boolean;
  setMicEnabled: (on: boolean) => void;
  agentSpeaking: boolean;
  userSpeaking: boolean;
  /** Normalised audio level 0-1, updated every animation frame */
  agentAudioLevelRef: React.RefObject<number>;
  /** Normalised audio level 0-1, updated every animation frame */
  userAudioLevelRef: React.RefObject<number>;
  exerciseData: ExerciseData | null;
  report: string | null;
  reportStreaming: string | null;
  previousReports: string[];
  archiveReportAndReset: () => void;
  sessionEnded: boolean;
  resetSessionEnd: () => void;
  transcripts: ExamTranscriptLine[];
  /** Ids for current task type (empty for tache1). */
  orderedExerciseIds: string[];
  goToAnotherExercise: (mode: 'next' | 'previous' | 'random') => Promise<void>;
  sessionId: string | null;
  restartSequence: number;
  restartExam: () => Promise<void>;
}

const RealtimeExamContext = createContext<RealtimeExamContextValue | null>(null);

export function useRealtimeExam(): RealtimeExamContextValue {
  const ctx = useContext(RealtimeExamContext);
  if (!ctx) {
    throw new Error('useRealtimeExam must be used within RealtimeExamProvider');
  }
  return ctx;
}

export function RealtimeExamProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [reportDeliveryError, setReportDeliveryError] = useState<string | null>(null);
  const [micEnabled, setMicEnabledState] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [exerciseData, setExerciseData] = useState<ExerciseData | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportStreaming, setReportStreaming] = useState<string | null>(null);
  const [previousReports, setPreviousReports] = useState<string[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [transcripts, setTranscripts] = useState<ExamTranscriptLine[]>([]);
  const [orderedExerciseIds, setOrderedExerciseIds] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restartSequence, setRestartSequence] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [mode, setMode] = useState<AttemptMode>('practice');
  const [needsProviderKey, setNeedsProviderKey] = useState(false);
  const [preparation, setPreparation] = useState<PreparationState | null>(null);
  const [timeUpAt, setTimeUpAt] = useState<number | null>(null);
  const [attemptCompleted, setAttemptCompleted] = useState(false);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const currentTaskTypeRef = useRef<string | null>(null);
  const currentExerciseIdRef = useRef<string | undefined>(undefined);
  const orderedExerciseIdsRef = useRef<string[]>([]);
  const historySnapshotRef = useRef<RealtimeItem[]>([]);
  const assistantStreamBufRef = useRef<Record<string, string>>({});
  const restartExamRef = useRef<() => Promise<void>>(async () => {});
  const attemptIdRef = useRef<string | null>(null);
  const modeRef = useRef<AttemptMode>('practice');
  const taskStartedAtRef = useRef<number | null>(null);
  const attemptDoneRef = useRef(false);
  const usageRef = useRef({ inputTokens: 0, outputTokens: 0 });
  const transcriptsRef = useRef<ExamTranscriptLine[]>([]);
  const lastCheckpointKeyRef = useRef('');
  const checkpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped by every connect and by `end()`: stale async continuations bail out. */
  const connectIdRef = useRef(0);
  const preparationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preparationResolveRef = useRef<(() => void) | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const userVadRafRef = useRef<number>(0);
  const agentVadRafRef = useRef<number>(0);
  const agentVadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userAudioLevelRef = useRef<number>(0);
  const agentAudioLevelRef = useRef<number>(0);

  function getSharedAudioCtx(): AudioContext {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }

  const stopUserVad = useCallback(() => {
    if (userVadRafRef.current) {
      cancelAnimationFrame(userVadRafRef.current);
      userVadRafRef.current = 0;
    }
    userAudioLevelRef.current = 0;
    setUserSpeaking(false);
  }, []);

  const stopAgentVad = useCallback(() => {
    if (agentVadRafRef.current) {
      cancelAnimationFrame(agentVadRafRef.current);
      agentVadRafRef.current = 0;
    }
    if (agentVadTimerRef.current) {
      clearTimeout(agentVadTimerRef.current);
      agentVadTimerRef.current = null;
    }
    agentAudioLevelRef.current = 0;
    setAgentSpeaking(false);
  }, []);

  const startUserVad = useCallback(
    (stream: MediaStream) => {
      stopUserVad();
      const ctx = getSharedAudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const poll = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = buf[i] - 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setUserSpeaking(rms > 20);
        userAudioLevelRef.current = Math.min(rms / 22, 1);
        userVadRafRef.current = requestAnimationFrame(poll);
      };
      userVadRafRef.current = requestAnimationFrame(poll);
    },
    [stopUserVad]
  );

  const startAgentVad = useCallback(
    (audioEl: HTMLAudioElement) => {
      stopAgentVad();
      const tryConnect = () => {
        const remoteStream = audioEl.srcObject as MediaStream | null;
        if (!remoteStream || remoteStream.getAudioTracks().length === 0) {
          agentVadTimerRef.current = setTimeout(tryConnect, 200);
          return;
        }
        const ctx = getSharedAudioCtx();
        const source = ctx.createMediaStreamSource(remoteStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);

        const poll = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = buf[i] - 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          setAgentSpeaking(rms > 10);
          agentAudioLevelRef.current = Math.min(rms / 18, 1);
          agentVadRafRef.current = requestAnimationFrame(poll);
        };
        agentVadRafRef.current = requestAnimationFrame(poll);
      };
      tryConnect();
    },
    [stopAgentVad]
  );

  const clearCheckpointTimer = useCallback(() => {
    if (checkpointTimerRef.current) {
      clearTimeout(checkpointTimerRef.current);
      checkpointTimerRef.current = null;
    }
  }, []);

  /**
   * Saves the running attempt exactly once. A task where the candidate never
   * spoke is deleted instead of leaving an empty entry in the history.
   */
  const persistAttempt = useCallback(
    (options: { keepalive?: boolean } = {}): Promise<void> => {
      const id = attemptIdRef.current;
      if (!id || attemptDoneRef.current) return Promise.resolve();
      attemptDoneRef.current = true;
      clearCheckpointTimer();

      const lines = toApiLines(transcriptsRef.current);
      const candidateSpoke = lines.some((l) => l.speaker === 'candidate');
      if (!candidateSpoke) {
        return api.deleteAttempt(id).then(
          () => undefined,
          () => undefined
        );
      }
      const startedAt = taskStartedAtRef.current ?? Date.now();
      const durationS = Math.min(3600, Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
      const { inputTokens, outputTokens } = usageRef.current;
      setAttemptCompleted(true);
      return api
        .completeAttempt(
          {
            attemptId: id,
            lines,
            durationS,
            ...(inputTokens + outputTokens > 0 ? { usage: { inputTokens, outputTokens } } : {}),
          },
          { keepalive: options.keepalive }
        )
        .then(
          () => undefined,
          () => {
            toastAlert({
              title: "Impossible d'enregistrer la tentative",
              description: (
                <p className="w-full text-sm">Votre transcription n&apos;a pas été sauvegardée.</p>
              ),
            });
          }
        );
    },
    [clearCheckpointTimer]
  );

  const end = useCallback(() => {
    connectIdRef.current += 1;
    void persistAttempt({ keepalive: true });
    clearCheckpointTimer();
    if (timeUpTimerRef.current) {
      clearTimeout(timeUpTimerRef.current);
      timeUpTimerRef.current = null;
    }
    if (preparationTimerRef.current) {
      clearInterval(preparationTimerRef.current);
      preparationTimerRef.current = null;
    }
    preparationResolveRef.current?.();
    preparationResolveRef.current = null;
    setPreparation(null);
    sessionRef.current?.close();
    sessionRef.current = null;
    stopUserVad();
    stopAgentVad();
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setFatalError(null);
    setReportDeliveryError(null);
    setIsConnected(false);
    setIsConnecting(false);
    setMicEnabledState(false);
    setAgentSpeaking(false);
    setUserSpeaking(false);
    setExerciseData(null);
    setReport(null);
    setReportStreaming(null);
    setSessionEnded(false);
    setTranscripts([]);
    setOrderedExerciseIds([]);
    orderedExerciseIdsRef.current = [];
    historySnapshotRef.current = [];
    assistantStreamBufRef.current = {};
    setSessionId(null);
    sessionIdRef.current = null;
    attemptIdRef.current = null;
    setAttemptId(null);
    setRunId(null);
    setTimeUpAt(null);
    setAttemptCompleted(false);
    transcriptsRef.current = [];
    lastCheckpointKeyRef.current = '';
    taskStartedAtRef.current = null;
    usageRef.current = { inputTokens: 0, outputTokens: 0 };
  }, [stopUserVad, stopAgentVad, persistAttempt, clearCheckpointTimer]);

  const setMicEnabled = useCallback((on: boolean) => {
    setMicEnabledState(on);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }, []);

  const archiveReportAndReset = useCallback(() => {
    setReport((current) => {
      if (current) {
        setPreviousReports((prev) => [...prev, current]);
      }
      return null;
    });
    setReportStreaming(null);
  }, []);

  const resetSessionEnd = useCallback(() => {
    setSessionEnded(false);
  }, []);

  const flushTranscripts = useCallback(() => {
    const base = transcriptLinesFromHistory(historySnapshotRef.current);
    pruneStreamBuffer(base, assistantStreamBufRef.current);
    const merged = mergeStreamingAssistantText(base, { ...assistantStreamBufRef.current });
    transcriptsRef.current = merged;
    setTranscripts(merged);
  }, []);

  const sendCheckpoint = useCallback((options: { keepalive?: boolean } = {}) => {
    const id = attemptIdRef.current;
    if (!id || attemptDoneRef.current) return;
    const lines = toApiLines(transcriptsRef.current);
    const key = `${lines.length}:${lines[lines.length - 1]?.text.length ?? 0}`;
    if (lines.length === 0 || key === lastCheckpointKeyRef.current) return;
    lastCheckpointKeyRef.current = key;
    // Best effort: the final `complete` call carries the full transcript anyway.
    api.checkpointAttempt({ attemptId: id, lines }, options).catch(() => {
      lastCheckpointKeyRef.current = '';
    });
  }, []);

  // Debounced autosave while the transcript grows, plus a last save when the tab is hidden/closed.
  useEffect(() => {
    if (!attemptIdRef.current || attemptDoneRef.current || transcripts.length === 0) return;
    if (checkpointTimerRef.current) return;
    checkpointTimerRef.current = setTimeout(() => {
      checkpointTimerRef.current = null;
      sendCheckpoint();
    }, CHECKPOINT_DEBOUNCE_MS);
  }, [transcripts, sendCheckpoint]);

  useEffect(() => {
    const onPageHide = () => sendCheckpoint({ keepalive: true });
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [sendCheckpoint]);

  const waitForPreparation = useCallback((seconds: number) => {
    return new Promise<void>((resolve) => {
      let left = seconds;
      setPreparation({ secondsLeft: left });
      const finish = () => {
        if (preparationTimerRef.current) clearInterval(preparationTimerRef.current);
        preparationTimerRef.current = null;
        preparationResolveRef.current = null;
        setPreparation(null);
        resolve();
      };
      preparationResolveRef.current = finish;
      preparationTimerRef.current = setInterval(() => {
        left -= 1;
        if (left <= 0) finish();
        else setPreparation({ secondsLeft: left });
      }, 1000);
    });
  }, []);

  const skipPreparation = useCallback(() => {
    preparationResolveRef.current?.();
  }, []);

  const connectToExam = useCallback(
    async (taskType: string, exerciseId?: string, options: StartOptions = {}) => {
      const connectId = ++connectIdRef.current;
      const isStale = () => connectIdRef.current !== connectId;
      setFatalError(null);
      setNeedsProviderKey(false);
      setReportDeliveryError(null);
      setIsConnecting(true);
      attemptDoneRef.current = false;
      setAttemptCompleted(false);
      usageRef.current = { inputTokens: 0, outputTokens: 0 };
      lastCheckpointKeyRef.current = '';
      transcriptsRef.current = [];
      historySnapshotRef.current = [];
      assistantStreamBufRef.current = {};
      setTranscripts([]);
      currentTaskTypeRef.current = taskType;
      currentExerciseIdRef.current = exerciseId;
      try {
        const data = await api.createExamSession({
          taskType: taskType as TaskType,
          exerciseId,
          mode: options.mode ?? 'practice',
          runId: options.runId,
        });
        if (isStale()) {
          // The user left while the session was being created: drop the empty attempt.
          void api.deleteAttempt(data.attemptId).catch(() => undefined);
          return;
        }

        attemptIdRef.current = data.attemptId;
        modeRef.current = options.mode ?? 'practice';
        setAttemptId(data.attemptId);
        setRunId(data.runId);
        setMode(options.mode ?? 'practice');
        sessionIdRef.current = data.sessionId;
        setSessionId(data.sessionId);
        setExerciseData(data.exerciseData);
        const ids = data.orderedExerciseIds ?? [];
        setOrderedExerciseIds(ids);
        orderedExerciseIdsRef.current = ids;
        if (data.exerciseData.taskType) {
          syncExerciseUrl(data.exerciseData.taskType, data.exerciseData.exerciseId);
        }

        const preparationS = TASK_DURATIONS[taskType as TaskType]?.preparationS ?? 0;
        if (preparationS > 0) {
          await waitForPreparation(preparationS);
          if (isStale()) return;
        }

        const instructions = `${data.agentConfig.instructions}\n\n--- Consigne d'accueil initiale (à respecter au démarrage) ---\n${data.agentConfig.greeting}`;

        const finSession = tool({
          name: 'finSession',
          description:
            "Signale la fin de la session d'examen. Doit être appelé AVANT envoiRapport pour couper le micro du candidat pendant la génération du rapport.",
          parameters: z.object({}),
          execute: async () => {
            // The exam part is over: save it now, before the coaching conversation starts.
            flushTranscripts();
            void persistAttempt();
            setSessionEnded(true);
            setMicEnabledState(false);
            mediaStreamRef.current?.getAudioTracks().forEach((t) => {
              t.enabled = false;
            });
            return FIN_SESSION_NEXT;
          },
        });

        const envoiRapport = tool({
          name: 'envoiRapport',
          description: 'Envoie le rapport en format markdown à la fin de la session',
          parameters: z.object({
            report: z.string().describe('Le rapport à envoyer'),
          }),
          execute: async ({ report: reportText }) => {
            setReportDeliveryError(null);
            setReport(reportText);
            setReportStreaming(null);
            setMicEnabledState(true);
            mediaStreamRef.current?.getAudioTracks().forEach((t) => {
              t.enabled = true;
            });
            return ENVOI_RAPPORT_NEXT;
          },
        });

        const recommencerTest = tool({
          name: 'recommencerTest',
          description:
            "À appeler lorsque le candidat demande de recommencer le test ou de refaire l'épreuve depuis le début. Réinitialise la conversation et le déroulement comme au premier lancement.",
          parameters: z.object({}),
          execute: async () => {
            void restartExamRef.current();
            return RECOMMENCER_TEST_NEXT;
          },
        });

        const agent = new RealtimeAgent({
          name: 'Examinateur TCF',
          instructions,
          voice: data.agentConfig.voice,
          tools: [finSession, envoiRapport, recommencerTest],
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        stream.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
        mediaStreamRef.current = stream;
        startUserVad(stream);

        if (!audioElRef.current) {
          audioElRef.current = document.createElement('audio');
          audioElRef.current.autoplay = true;
        }

        const transport = new OpenAIRealtimeWebRTC({
          mediaStream: stream,
          audioElement: audioElRef.current,
        });

        const session = new RealtimeSession(agent, {
          transport,
          model: data.agentConfig.model,
          config: {
            audio: {
              input: {
                noiseReduction: { type: 'near_field' },
              },
            },
          },
        });
        sessionRef.current = session;

        session.on('transport_event', (event: TransportEvent) => {
          if (sessionRef.current !== session) return;
          if (
            event &&
            typeof event === 'object' &&
            'type' in event &&
            (event as { type?: string }).type === 'response.output_text.delta' &&
            typeof (event as { item_id?: unknown }).item_id === 'string' &&
            typeof (event as { delta?: unknown }).delta === 'string'
          ) {
            const e = event as { type: string; item_id: string; delta: string };
            assistantStreamBufRef.current[e.item_id] =
              (assistantStreamBufRef.current[e.item_id] ?? '') + e.delta;
            flushTranscripts();
          }
          if (
            event &&
            typeof event === 'object' &&
            'type' in event &&
            (event as { type?: string }).type === 'response.output_audio_transcript.delta' &&
            typeof (event as { item_id?: unknown }).item_id === 'string' &&
            typeof (event as { delta?: unknown }).delta === 'string'
          ) {
            const e = event as { type: string; item_id: string; delta: string };
            assistantStreamBufRef.current[e.item_id] =
              (assistantStreamBufRef.current[e.item_id] ?? '') + e.delta;
            flushTranscripts();
          }
          if (event.type === 'response.done') {
            const usage = (
              event as { response?: { usage?: { input_tokens?: number; output_tokens?: number } } }
            ).response?.usage;
            if (usage) {
              usageRef.current.inputTokens += usage.input_tokens ?? 0;
              usageRef.current.outputTokens += usage.output_tokens ?? 0;
            }
          }
          if (event.type === 'function_call' && event.name === 'envoiRapport') {
            const partial = extractPartialReportFromToolArgs(event.arguments ?? '');
            if (partial !== null && partial.length > 0) {
              setReportStreaming(partial);
            }
          }
          if (event.type === 'error') {
            const err = event as { error?: unknown };
            const msg =
              err.error instanceof Error
                ? err.error.message
                : typeof err.error === 'string'
                  ? err.error
                  : 'Erreur Realtime';
            setFatalError(msg);
          }
        });

        session.on('error', (payload: unknown) => {
          if (sessionRef.current !== session) return;
          const msg = messageFromSessionError(payload);
          setReportDeliveryError(msg);
          toastAlert({
            title: 'Erreur pendant la session',
            description: <p className="w-full text-sm">{msg}</p>,
          });
        });

        session.on('history_updated', (history: RealtimeItem[]) => {
          if (sessionRef.current !== session) return;
          historySnapshotRef.current = history;
          flushTranscripts();
        });

        await session.connect({
          apiKey: data.clientSecret,
          model: data.agentConfig.model,
        });

        if (audioElRef.current) {
          startAgentVad(audioElRef.current);
        }

        session.sendMessage({
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: "Le candidat est prêt. Commence la session d'examen immédiatement en suivant ta consigne d'accueil et ton rôle d'examinateur.",
            },
          ],
        });

        taskStartedAtRef.current = Date.now();
        setTimeUpAt(Date.now() + (TASK_DURATIONS[taskType as TaskType]?.speakingS ?? 0) * 1000);
        setIsConnected(true);
      } catch (e) {
        if (isStale()) return;
        if (e instanceof ApiError && e.code === 'PROVIDER_NOT_CONFIGURED') {
          setNeedsProviderKey(true);
        }
        const msg = e instanceof Error ? e.message : String(e);
        setFatalError(msg);
        end();
      } finally {
        if (!isStale()) setIsConnecting(false);
      }
    },
    [end, startUserVad, startAgentVad, flushTranscripts, persistAttempt, waitForPreparation]
  );

  const start = useCallback(
    async (taskType: string, exerciseId?: string, options?: StartOptions) => {
      if (isConnecting || isConnected || isRestarting) return;
      await connectToExam(taskType, exerciseId, options);
    },
    [connectToExam, isConnecting, isConnected, isRestarting]
  );

  const restartExam = useCallback(async () => {
    const taskType = currentTaskTypeRef.current ?? exerciseData?.taskType ?? null;
    const exerciseId = currentExerciseIdRef.current ?? exerciseData?.exerciseId;
    if (!taskType) return;

    archiveReportAndReset();
    resetSessionEnd();
    setRestartSequence((current) => current + 1);
    setIsRestarting(true);
    end();
    try {
      await connectToExam(taskType, exerciseId, { mode: 'practice' });
    } finally {
      setIsRestarting(false);
    }
  }, [archiveReportAndReset, resetSessionEnd, end, connectToExam, exerciseData]);

  const goToAnotherExercise = useCallback(
    async (mode: 'next' | 'previous' | 'random') => {
      const taskType = currentTaskTypeRef.current ?? exerciseData?.taskType;
      if (!taskType) return;
      const ids = orderedExerciseIdsRef.current;
      if (ids.length === 0) return;
      const currentId = currentExerciseIdRef.current ?? exerciseData?.exerciseId;
      const nextId =
        mode === 'next'
          ? nextExerciseIdSequential(ids, currentId)
          : mode === 'previous'
            ? previousExerciseIdSequential(ids, currentId)
            : nextExerciseIdRandom(ids, currentId);

      archiveReportAndReset();
      resetSessionEnd();
      setRestartSequence((c) => c + 1);
      setIsRestarting(true);
      end();
      try {
        await connectToExam(taskType, nextId, { mode: 'practice' });
      } finally {
        setIsRestarting(false);
      }
    },
    [archiveReportAndReset, resetSessionEnd, end, connectToExam, exerciseData]
  );

  const finishTask = useCallback(async () => {
    flushTranscripts();
    await persistAttempt();
    sessionRef.current?.close();
    setMicEnabledState(false);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
  }, [flushTranscripts, persistAttempt]);

  const onTimeUp = useCallback(() => {
    if (attemptDoneRef.current) return;
    if (modeRef.current !== 'full') {
      toastAlert({
        title: 'Temps écoulé',
        description: (
          <p className="w-full text-sm">
            Le temps officiel de cette tâche est écoulé. Vous pouvez continuer à vous entraîner.
          </p>
        ),
      });
      return;
    }
    // Exam mode: let the examiner close the task, then stop the session.
    sessionRef.current?.sendMessage({
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: TIME_UP_MESSAGE }],
    });
    setMicEnabledState(false);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
    timeUpTimerRef.current = setTimeout(() => {
      timeUpTimerRef.current = null;
      void finishTask();
    }, TIME_UP_GRACE_MS);
  }, [finishTask]);

  restartExamRef.current = restartExam;

  useEffect(() => {
    return () => {
      end();
    };
  }, [end]);

  const value = useMemo<RealtimeExamContextValue>(
    () => ({
      attemptId,
      runId,
      mode,
      needsProviderKey,
      preparation,
      skipPreparation,
      timeUpAt,
      attemptCompleted,
      onTimeUp,
      finishTask,
      isConnected,
      isConnecting,
      isRestarting,
      fatalError,
      reportDeliveryError,
      start,
      end,
      micEnabled,
      setMicEnabled,
      agentSpeaking,
      userSpeaking,
      agentAudioLevelRef,
      userAudioLevelRef,
      exerciseData,
      report,
      reportStreaming,
      previousReports,
      archiveReportAndReset,
      sessionEnded,
      resetSessionEnd,
      transcripts,
      orderedExerciseIds,
      goToAnotherExercise,
      sessionId,
      restartSequence,
      restartExam,
    }),
    [
      attemptId,
      runId,
      mode,
      needsProviderKey,
      preparation,
      skipPreparation,
      timeUpAt,
      attemptCompleted,
      onTimeUp,
      finishTask,
      isConnected,
      isConnecting,
      isRestarting,
      fatalError,
      reportDeliveryError,
      start,
      end,
      micEnabled,
      setMicEnabled,
      agentSpeaking,
      userSpeaking,
      exerciseData,
      report,
      reportStreaming,
      previousReports,
      archiveReportAndReset,
      sessionEnded,
      resetSessionEnd,
      transcripts,
      orderedExerciseIds,
      goToAnotherExercise,
      sessionId,
      restartSequence,
      restartExam,
    ]
  );

  return <RealtimeExamContext.Provider value={value}>{children}</RealtimeExamContext.Provider>;
}
