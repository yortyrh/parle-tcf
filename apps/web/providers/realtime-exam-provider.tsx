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
import { type Socket, io } from 'socket.io-client';
import { z } from 'zod';
import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  type RealtimeItem,
  RealtimeSession,
  type TransportEvent,
  tool,
} from '@openai/agents/realtime';
import type { ExerciseData, ExerciseImagePayload, TaskType } from '@yorty-tcf/shared';
import { SOCKET_EVENTS, TCF_TASK_TYPES } from '@yorty-tcf/shared';
import { createExamSession } from '@/lib/exam-api';
import { extractPartialReportFromToolArgs } from '@/lib/report-stream';
import { type ExamTranscriptLine, transcriptLinesFromHistory } from '@/lib/transcript-from-history';

function getExamApiBase(): string {
  const base = process.env.NEXT_PUBLIC_EXAM_API_URL;
  if (!base) return 'http://localhost:3001';
  return base.replace(/\/$/, '');
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

export interface RealtimeExamContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  fatalError: string | null;
  start: (taskType: string, exerciseId?: string) => Promise<void>;
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
  exerciseImage: ExerciseImagePayload | null;
  report: string | null;
  reportStreaming: string | null;
  previousReports: string[];
  archiveReportAndReset: () => void;
  sessionEnded: boolean;
  resetSessionEnd: () => void;
  transcripts: ExamTranscriptLine[];
  sessionId: string | null;
  restartExam: () => void;
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
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [micEnabled, setMicEnabledState] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [exerciseData, setExerciseData] = useState<ExerciseData | null>(null);
  const [exerciseImage, setExerciseImage] = useState<ExerciseImagePayload | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportStreaming, setReportStreaming] = useState<string | null>(null);
  const [previousReports, setPreviousReports] = useState<string[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [transcripts, setTranscripts] = useState<ExamTranscriptLine[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const userVadRafRef = useRef<number>(0);
  const agentVadRafRef = useRef<number>(0);
  const agentVadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userAudioLevelRef = useRef<number>(0);
  const agentAudioLevelRef = useRef<number>(0);

  const cleanupSocket = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

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

  const end = useCallback(() => {
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
    setIsConnected(false);
    setIsConnecting(false);
    setMicEnabledState(false);
    setAgentSpeaking(false);
    setUserSpeaking(false);
    setExerciseData(null);
    setExerciseImage(null);
    setReport(null);
    setReportStreaming(null);
    setSessionEnded(false);
    setTranscripts([]);
    setSessionId(null);
    sessionIdRef.current = null;
    cleanupSocket();
  }, [cleanupSocket, stopUserVad, stopAgentVad]);

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

  const start = useCallback(
    async (taskType: string, exerciseId?: string) => {
      if (isConnecting || isConnected) return;
      setFatalError(null);
      setIsConnecting(true);
      try {
        const data = await createExamSession({
          taskType: taskType as TaskType,
          exerciseId,
        });

        sessionIdRef.current = data.sessionId;
        setSessionId(data.sessionId);
        setExerciseData(data.exerciseData);
        if (data.exerciseData.taskType) {
          syncExerciseUrl(data.exerciseData.taskType, data.exerciseData.exerciseId);
        }
        setExerciseImage(data.exerciseImage);

        const apiBase = getExamApiBase();
        const socket = io(apiBase, {
          path: '/socket.io',
          transports: ['websocket'],
          autoConnect: true,
        });
        socketRef.current = socket;
        socket.emit(SOCKET_EVENTS.JOIN_SESSION, { sessionId: data.sessionId });

        const instructions = `${data.agentConfig.instructions}\n\n--- Consigne d'accueil initiale (à respecter au démarrage) ---\n${data.agentConfig.greeting}`;

        const finSession = tool({
          name: 'finSession',
          description:
            "Signale la fin de la session d'examen. Doit être appelé AVANT envoiRapport pour couper le micro du candidat pendant la génération du rapport.",
          parameters: z.object({}),
          execute: async () => {
            setSessionEnded(true);
            setMicEnabledState(false);
            mediaStreamRef.current?.getAudioTracks().forEach((t) => {
              t.enabled = false;
            });
            socket.emit(SOCKET_EVENTS.SESSION_END, { sessionId: data.sessionId });
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
            setReport(reportText);
            setReportStreaming(null);
            socket.emit(SOCKET_EVENTS.REPORT, {
              sessionId: data.sessionId,
              report: reportText,
            });
            setMicEnabledState(true);
            mediaStreamRef.current?.getAudioTracks().forEach((t) => {
              t.enabled = true;
            });
            return ENVOI_RAPPORT_NEXT;
          },
        });

        const agent = new RealtimeAgent({
          name: 'Examinateur TCF/TEF',
          instructions,
          voice: data.agentConfig.voice,
          tools: [finSession, envoiRapport],
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

        session.on('history_updated', (history: RealtimeItem[]) => {
          setTranscripts(transcriptLinesFromHistory(history));
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

        setIsConnected(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setFatalError(msg);
        end();
      } finally {
        setIsConnecting(false);
      }
    },
    [isConnecting, isConnected, end, startUserVad, startAgentVad]
  );

  const restartExam = useCallback(() => {
    const session = sessionRef.current;
    const sid = sessionIdRef.current;
    if (!session || !sid) return;

    archiveReportAndReset();
    resetSessionEnd();
    setReportStreaming(null);
    setMicEnabled(false);

    socketRef.current?.emit(SOCKET_EVENTS.SESSION_RESTART, { sessionId: sid });

    session.interrupt();
    session.updateHistory([]);
    session.sendMessage({
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: "Le candidat demande de recommencer le test. Réinitialise entièrement ton comportement : tu redeviens l'examinateur au début de l'épreuve et tu suis à nouveau la consigne d'accueil initiale.",
        },
      ],
    });
  }, [archiveReportAndReset, resetSessionEnd, setMicEnabled]);

  useEffect(() => {
    return () => {
      end();
    };
  }, [end]);

  const value = useMemo<RealtimeExamContextValue>(
    () => ({
      isConnected,
      isConnecting,
      fatalError,
      start,
      end,
      micEnabled,
      setMicEnabled,
      agentSpeaking,
      userSpeaking,
      agentAudioLevelRef,
      userAudioLevelRef,
      exerciseData,
      exerciseImage,
      report,
      reportStreaming,
      previousReports,
      archiveReportAndReset,
      sessionEnded,
      resetSessionEnd,
      transcripts,
      sessionId,
      restartExam,
    }),
    [
      isConnected,
      isConnecting,
      fatalError,
      start,
      end,
      micEnabled,
      setMicEnabled,
      agentSpeaking,
      userSpeaking,
      exerciseData,
      exerciseImage,
      report,
      reportStreaming,
      previousReports,
      archiveReportAndReset,
      sessionEnded,
      resetSessionEnd,
      transcripts,
      sessionId,
      restartExam,
    ]
  );

  return <RealtimeExamContext.Provider value={value}>{children}</RealtimeExamContext.Provider>;
}
