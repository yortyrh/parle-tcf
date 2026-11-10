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
import { AttemptRecorder } from '@/lib/audio-recorder';
import { restartOptions } from '@/lib/exam-flow';
import { GeminiLiveSession } from '@/lib/gemini-live';
import {
  nextExerciseIdRandom,
  nextExerciseIdSequential,
  previousExerciseIdSequential,
} from '@/lib/next-exercise-id';
import { type ExamTranscriptLine, transcriptLinesFromHistory } from '@/lib/transcript-from-history';
import { mergeStreamingAssistantText, pruneStreamBuffer } from '@/lib/transcript-merge';

function messageFromSessionError(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const inner = payload.error;
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

/** Best effort: a failed upload never affects the attempt itself. */
async function uploadRecording(
  attemptId: string,
  pending: Promise<Awaited<ReturnType<AttemptRecorder['stop']>>> | null
): Promise<void> {
  try {
    const recording = await pending;
    if (!recording) return;
    const { url, fields, maxBytes } = await api.getAudioUploadUrl({
      attemptId,
      contentType: recording.contentType,
    });
    if (recording.blob.size > maxBytes) return;
    // Presigned POST: the policy fields first, the file last.
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.append(name, value);
    form.append('file', recording.blob);
    const res = await fetch(url, { method: 'POST', body: form });
    if (!res.ok) return;
    await api.confirmAudioUpload(attemptId);
  } catch {
    // The transcript and evaluation are unaffected.
  }
}

const FIN_SESSION_NEXT =
  "L'épreuve est terminée. Dis simplement au revoir au candidat en une phrase, sans rapport ni commentaire.";

/** Delay letting the examiner's farewell play before the task is closed. */
const FAREWELL_GRACE_MS = 6000;

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
  /** The voice connection closed before the task was completed (network, provider). */
  sessionClosed: boolean;
  /** Called by the countdown at 0: closes the task in exam mode, only warns in practice. */
  onTimeUp: () => void;
  /** Saves the attempt, stops the session and keeps the result screen state. */
  finishTask: () => Promise<void>;
  isConnected: boolean;
  isConnecting: boolean;
  isRestarting: boolean;
  fatalError: string | null;
  /** Erreur session/outil (ex. échec d’envoi du rapport) — affichée à la place du loader infini */
  sessionError: string | null;
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
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [micEnabled, setMicEnabledState] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [exerciseData, setExerciseData] = useState<ExerciseData | null>(null);
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
  const [sessionClosed, setSessionClosed] = useState(false);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const currentTaskTypeRef = useRef<string | null>(null);
  const currentExerciseIdRef = useRef<string | undefined>(undefined);
  const orderedExerciseIdsRef = useRef<string[]>([]);
  const historySnapshotRef = useRef<RealtimeItem[]>([]);
  const assistantStreamBufRef = useRef<Record<string, string>>({});
  const recorderRef = useRef<AttemptRecorder | null>(null);
  const geminiRef = useRef<GeminiLiveSession | null>(null);
  const finishTaskRef = useRef<() => Promise<void>>(async () => {});
  const restartExamRef = useRef<() => Promise<void>>(async () => {});
  const attemptIdRef = useRef<string | null>(null);
  const modeRef = useRef<AttemptMode>('practice');
  const runIdRef = useRef<string | null>(null);
  /** Set once the limit warning fired for the running attempt. */
  const limitReachedRef = useRef(false);
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
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (!candidateSpoke) {
        recorder?.discard();
        return api.deleteAttempt(id).then(
          () => undefined,
          () => undefined
        );
      }
      const { inputTokens, outputTokens } = usageRef.current;
      setAttemptCompleted(true);
      // The recording is finalised now (before the mic tracks stop); a page unload
      // cannot wait for an upload, so it is dropped in that case.
      const recording = options.keepalive ? Promise.resolve(null) : (recorder?.stop() ?? null);
      if (options.keepalive) recorder?.discard();
      return api
        .completeAttempt(
          {
            attemptId: id,
            lines,
            ...(inputTokens + outputTokens > 0 ? { usage: { inputTokens, outputTokens } } : {}),
          },
          { keepalive: options.keepalive }
        )
        .then(
          () => uploadRecording(id, recording),
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
    geminiRef.current?.close();
    geminiRef.current = null;
    stopUserVad();
    stopAgentVad();
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    recorderRef.current?.discard();
    recorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setFatalError(null);
    setSessionError(null);
    setIsConnected(false);
    setIsConnecting(false);
    setMicEnabledState(false);
    setAgentSpeaking(false);
    setUserSpeaking(false);
    setExerciseData(null);
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
    runIdRef.current = null;
    setTimeUpAt(null);
    setAttemptCompleted(false);
    setSessionClosed(false);
    limitReachedRef.current = false;
    transcriptsRef.current = [];
    lastCheckpointKeyRef.current = '';
    usageRef.current = { inputTokens: 0, outputTokens: 0 };
  }, [stopUserVad, stopAgentVad, persistAttempt, clearCheckpointTimer]);

  const setMicEnabled = useCallback((on: boolean) => {
    setMicEnabledState(on);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = on;
    });
  }, []);

  const resetSessionEnd = useCallback(() => {
    setSessionEnded(false);
  }, []);

  const flushTranscripts = useCallback(() => {
    // Gemini sessions push their own transcript lines; there is no OpenAI history.
    if (geminiRef.current) return;
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
    api.checkpointAttempt({ attemptId: id, lines }, options).then(
      ({ limitReached }) => {
        if (!limitReached || limitReachedRef.current || attemptIdRef.current !== id) return;
        limitReachedRef.current = true;
        toastAlert({
          title: 'Limite d’utilisation atteinte',
          description: (
            <p className="w-full text-sm">
              Votre limite quotidienne ou mensuelle est atteinte : la tâche est enregistrée et la
              session s’arrête.
            </p>
          ),
        });
        void finishTaskRef.current();
      },
      () => {
        lastCheckpointKeyRef.current = '';
      }
    );
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
      setSessionError(null);
      setIsConnecting(true);
      attemptDoneRef.current = false;
      setAttemptCompleted(false);
      setSessionClosed(false);
      limitReachedRef.current = false;
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
        runIdRef.current = data.runId;
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
        // Tokens are short-lived (Gemini: the session must open within minutes):
        // after a preparation time, mint a fresh one right before connecting.
        let clientSecret = data.clientSecret;
        if (preparationS > 0) {
          ({ clientSecret } = await api.refreshSessionToken(data.attemptId));
          if (isStale()) return;
        }

        const instructions = `${data.agentConfig.instructions}\n\n--- Consigne d'accueil initiale (à respecter au démarrage) ---\n${data.agentConfig.greeting}`;

        const onFinSession = () => {
          // The task is over: save it now, then close it once the farewell has played.
          flushTranscripts();
          void persistAttempt();
          setSessionEnded(true);
          setMicEnabledState(false);
          mediaStreamRef.current?.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
          setTimeout(() => void finishTaskRef.current(), FAREWELL_GRACE_MS);
        };

        if (data.provider === 'gemini') {
          const geminiStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          if (isStale()) {
            geminiStream.getTracks().forEach((t) => t.stop());
            return;
          }
          geminiStream.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
          mediaStreamRef.current = geminiStream;
          const geminiRecorder = new AttemptRecorder();
          recorderRef.current = geminiRecorder;
          void api.getAudioStatus().then(
            (status) => {
              if (status.available && status.consent && recorderRef.current === geminiRecorder) {
                geminiRecorder.start(geminiStream);
              }
            },
            () => undefined
          );
          startUserVad(geminiStream);

          const live = new GeminiLiveSession({
            token: clientSecret,
            model: data.agentConfig.model,
            voice: data.agentConfig.voice,
            instructions,
            stream: geminiStream,
            onLines: (lines) => {
              if (geminiRef.current !== live) return;
              transcriptsRef.current = lines;
              setTranscripts(lines);
            },
            onAgentSpeaking: setAgentSpeaking,
            onUsage: (usage) => {
              usageRef.current = usage;
            },
            onTool: (name) => {
              // onFinSession already schedules finishTask after the farewell.
              if (name === 'finSession') {
                onFinSession();
              } else {
                void restartExamRef.current();
              }
            },
            onError: (message) => {
              if (geminiRef.current !== live) return;
              setSessionError(message);
              toastAlert({
                title: 'Erreur pendant la session',
                description: <p className="w-full text-sm">{message}</p>,
              });
            },
            onClose: () => {
              if (geminiRef.current !== live) return;
              flushTranscripts();
              void persistAttempt();
              setIsConnected(false);
              // Lets the UI offer to continue or retry instead of waiting forever.
              setSessionClosed(true);
            },
          });
          geminiRef.current = live;
          await live.connect();
          if (isStale()) {
            live.close();
            return;
          }
          live.sendText(
            "Le candidat est prêt. Commence la session d'examen immédiatement en suivant ta consigne d'accueil et ton rôle d'examinateur."
          );
          setTimeUpAt(Date.now() + (TASK_DURATIONS[taskType as TaskType]?.speakingS ?? 0) * 1000);
          setIsConnected(true);
          return;
        }

        const finSession = tool({
          name: 'finSession',
          description:
            "Signale la fin de la session d'examen. À appeler quand l'épreuve est terminée, après avoir dit au revoir.",
          parameters: z.object({}),
          execute: () => {
            onFinSession();
            return FIN_SESSION_NEXT;
          },
        });

        const recommencerTest = tool({
          name: 'recommencerTest',
          description:
            "À appeler lorsque le candidat demande de recommencer le test ou de refaire l'épreuve depuis le début. Réinitialise la conversation et le déroulement comme au premier lancement.",
          parameters: z.object({}),
          execute: () => {
            void restartExamRef.current();
            return RECOMMENCER_TEST_NEXT;
          },
        });

        const agent = new RealtimeAgent({
          name: 'Examinateur TCF',
          instructions,
          voice: data.agentConfig.voice,
          tools: [finSession, recommencerTest],
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
        // Recording only starts with explicit consent and server-side storage.
        const recorder = new AttemptRecorder();
        recorderRef.current = recorder;
        void api.getAudioStatus().then(
          (status) => {
            if (status.available && status.consent && recorderRef.current === recorder) {
              recorder.start(stream);
            }
          },
          () => undefined
        );
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
          setSessionError(msg);
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
          apiKey: clientSecret,
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

    // A full exam stays in its run; capture before end() clears the state.
    const options = restartOptions(modeRef.current, runIdRef.current);
    resetSessionEnd();
    setRestartSequence((current) => current + 1);
    setIsRestarting(true);
    end();
    try {
      await connectToExam(taskType, exerciseId, options);
    } finally {
      setIsRestarting(false);
    }
  }, [resetSessionEnd, end, connectToExam, exerciseData]);

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

      const options = restartOptions(modeRef.current, runIdRef.current);
      resetSessionEnd();
      setRestartSequence((c) => c + 1);
      setIsRestarting(true);
      end();
      try {
        await connectToExam(taskType, nextId, options);
      } finally {
        setIsRestarting(false);
      }
    },
    [resetSessionEnd, end, connectToExam, exerciseData]
  );

  const finishTask = useCallback(async () => {
    flushTranscripts();
    await persistAttempt();
    sessionRef.current?.close();
    geminiRef.current?.close();
    setMicEnabledState(false);
    mediaStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
  }, [flushTranscripts, persistAttempt]);

  finishTaskRef.current = finishTask;

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
    geminiRef.current?.sendText(TIME_UP_MESSAGE);
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
      sessionClosed,
      onTimeUp,
      finishTask,
      isConnected,
      isConnecting,
      isRestarting,
      fatalError,
      sessionError,
      start,
      end,
      micEnabled,
      setMicEnabled,
      agentSpeaking,
      userSpeaking,
      agentAudioLevelRef,
      userAudioLevelRef,
      exerciseData,
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
      sessionClosed,
      onTimeUp,
      finishTask,
      isConnected,
      isConnecting,
      isRestarting,
      fatalError,
      sessionError,
      start,
      end,
      micEnabled,
      setMicEnabled,
      agentSpeaking,
      userSpeaking,
      exerciseData,
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
