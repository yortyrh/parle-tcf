import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateExamSessionOutput } from '@parle-tcf/shared';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { ExamRunApp } from '@/components/app/exam-run-app';
import { toastAlert } from '@/components/ui/alert-toast';
import { ApiError, api } from '@/lib/api';
import type { GeminiLiveOptions } from '@/lib/gemini-live';
import { RealtimeExamProvider, toApiLines, useRealtimeExam } from './realtime-exam-provider';

const fakes = vi.hoisted(() => {
  type Tool = { name: string; description: string; execute: () => string };

  class FakeAgent {
    static instances: FakeAgent[] = [];
    constructor(
      readonly config: { name: string; instructions: string; voice: string; tools: Tool[] }
    ) {
      FakeAgent.instances.push(this);
    }
  }

  class FakeRealtimeSession {
    static instances: FakeRealtimeSession[] = [];
    static connectResult: () => Promise<void> = () => Promise.resolve();
    handlers = new Map<string, (arg: unknown) => void>();
    connect = vi.fn((_opts: { apiKey: string; model: string }) =>
      FakeRealtimeSession.connectResult()
    );
    sendMessage = vi.fn();
    close = vi.fn();
    constructor(
      readonly agent: FakeAgent,
      readonly options: { model: string; config?: { audio?: { input?: unknown } } }
    ) {
      FakeRealtimeSession.instances.push(this);
    }
    on(event: string, cb: (arg: unknown) => void) {
      this.handlers.set(event, cb);
    }
    emit(event: string, arg: unknown) {
      this.handlers.get(event)?.(arg);
    }
  }

  class FakeGemini {
    static instances: FakeGemini[] = [];
    static connectResult: () => Promise<void> = () => Promise.resolve();
    connect = vi.fn(() => FakeGemini.connectResult());
    sendText = vi.fn();
    close = vi.fn();
    constructor(readonly opts: GeminiLiveOptions) {
      FakeGemini.instances.push(this);
    }
  }

  class FakeRecorder {
    static instances: FakeRecorder[] = [];
    static recording: { blob: Blob; contentType: 'audio/webm' } | null = null;
    start = vi.fn(() => true);
    stop = vi.fn(() => Promise.resolve(FakeRecorder.recording));
    discard = vi.fn();
    constructor() {
      FakeRecorder.instances.push(this);
    }
  }

  return { FakeAgent, FakeRealtimeSession, FakeGemini, FakeRecorder };
});

vi.mock('@openai/agents/realtime', () => ({
  RealtimeAgent: fakes.FakeAgent,
  RealtimeSession: fakes.FakeRealtimeSession,
  OpenAIRealtimeWebRTC: class {
    constructor(readonly options: unknown) {}
  },
  tool: (definition: unknown) => definition,
}));
vi.mock('@/lib/gemini-live', () => ({ GeminiLiveSession: fakes.FakeGemini }));
vi.mock('@/lib/audio-recorder', () => ({ AttemptRecorder: fakes.FakeRecorder }));
vi.mock('@/components/ui/alert-toast', () => ({ toastAlert: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/examen',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: {
      createExamSession: vi.fn(),
      refreshSessionToken: vi.fn(),
      checkpointAttempt: vi.fn(),
      completeAttempt: vi.fn(),
      deleteAttempt: vi.fn(),
      getAudioStatus: vi.fn(),
      getAudioUploadUrl: vi.fn(),
      confirmAudioUpload: vi.fn(),
    },
  };
});

const { FakeAgent, FakeRealtimeSession, FakeGemini, FakeRecorder } = fakes;
const mockedApi = vi.mocked(api);
const toast = vi.mocked(toastAlert);

const ATTEMPT = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_2 = '22222222-2222-4222-8222-222222222222';
const RUN = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-03-01T10:00:00Z').getTime();

function sessionData(overrides: Partial<CreateExamSessionOutput> = {}): CreateExamSessionOutput {
  return {
    provider: 'openai',
    clientSecret: 'secret-1',
    sessionId: 'sess-1',
    attemptId: ATTEMPT,
    runId: null,
    exerciseData: { title: 'Tâche 1', description: 'Présentez-vous', taskType: 'tache1' },
    agentConfig: {
      instructions: 'Tu es examinateur.',
      greeting: 'Bonjour !',
      voice: 'alloy',
      model: 'gpt-realtime-mini',
      allowInterruptions: true,
    },
    orderedExerciseIds: [],
    ...overrides,
  };
}

const HISTORY = [
  {
    type: 'message',
    itemId: 'i1',
    role: 'assistant',
    status: 'completed',
    content: [{ type: 'output_audio', transcript: 'Bonjour, présentez-vous.' }],
  },
  {
    type: 'message',
    itemId: 'i2',
    role: 'user',
    status: 'completed',
    content: [{ type: 'input_audio', transcript: 'Je m’appelle Ana.' }],
  },
];

const EXPECTED_LINES = [
  { seq: 0, speaker: 'examiner', text: 'Bonjour, présentez-vous.' },
  { seq: 1, speaker: 'candidate', text: 'Je m’appelle Ana.' },
];

const TIME_UP_MESSAGE =
  "Le temps imparti pour cette tâche est écoulé. Applique la clôture maintenant : dis « Merci, l'épreuve est terminée. » puis appelle finSession, sans poser de nouvelle question.";

const FIN_SESSION_DESCRIPTION =
  "Clôt l'épreuve. À appeler une seule fois, juste après avoir dit « Merci, l'épreuve est terminée. », quand le temps est écoulé ou que le candidat demande d'arrêter. Ne jamais appeler pendant l'épreuve.";
const RECOMMENCER_TEST_DESCRIPTION =
  "Recommence l'épreuve depuis le début. À appeler uniquement si le candidat demande explicitement de recommencer l'épreuve, jamais pour une hésitation ou une reformulation.";

const START_MESSAGE =
  "Le candidat est prêt. Commence la session d'examen immédiatement en suivant ta consigne d'accueil et ton rôle d'examinateur.";

let track: { enabled: boolean; stop: ReturnType<typeof vi.fn> };
let micLevel: number;
let frames: FrameRequestCallback[];
let audioContexts: { close: ReturnType<typeof vi.fn> }[];

function installMedia() {
  track = { enabled: true, stop: vi.fn() };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(() => Promise.resolve(stream)) },
  });
  micLevel = 128;
  frames = [];
  audioContexts = [];
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running';
      resume = vi.fn();
      close = vi.fn(() => Promise.resolve());
      constructor() {
        audioContexts.push(this);
      }
      createMediaStreamSource = () => ({ connect: vi.fn() });
      createAnalyser = () => ({
        fftSize: 0,
        smoothingTimeConstant: 0,
        frequencyBinCount: 8,
        getByteTimeDomainData: (buf: Uint8Array) => buf.fill(micLevel),
      });
    }
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => frames.push(cb))
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

function renderProvider() {
  return renderHook(() => useRealtimeExam(), { wrapper: RealtimeExamProvider });
}

type Exam = ReturnType<typeof renderProvider>['result'];

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function startTask(
  result: Exam,
  ...args: Parameters<ReturnType<typeof useRealtimeExam>['start']>
) {
  await act(async () => {
    await result.current.start(...args);
  });
}

function lastSession() {
  const session = FakeRealtimeSession.instances.at(-1);
  if (!session) throw new Error('no realtime session');
  return session;
}

function lastGemini() {
  const gemini = FakeGemini.instances.at(-1);
  if (!gemini) throw new Error('no gemini session');
  return gemini;
}

function tool(name: string) {
  const found = FakeAgent.instances.at(-1)?.config.tools.find((t) => t.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
}

function emitHistory(history: unknown[] = HISTORY) {
  act(() => lastSession().emit('history_updated', history));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  installMedia();
  FakeAgent.instances = [];
  FakeRealtimeSession.instances = [];
  FakeRealtimeSession.connectResult = () => Promise.resolve();
  FakeGemini.instances = [];
  FakeGemini.connectResult = () => Promise.resolve();
  FakeRecorder.instances = [];
  FakeRecorder.recording = null;
  for (const fn of Object.values(mockedApi)) fn.mockReset();
  mockedApi.createExamSession.mockResolvedValue(sessionData());
  mockedApi.completeAttempt.mockResolvedValue({ ok: true });
  mockedApi.deleteAttempt.mockResolvedValue({ ok: true });
  mockedApi.checkpointAttempt.mockResolvedValue({ ok: true, limitReached: false });
  mockedApi.getAudioStatus.mockResolvedValue({ available: false, consent: false });
  mockedApi.refreshSessionToken.mockResolvedValue({ clientSecret: 'fresh-secret' });
  toast.mockReset();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  // Unmount while the stubbed browser APIs still exist.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('toApiLines', () => {
  it('keeps non-empty trimmed lines, maps speakers and keeps the original index as seq', () => {
    expect(
      toApiLines([
        { id: 'a', text: ' Bonjour ', isLocal: false, timestamp: 0 },
        { id: 'b', text: '   ', isLocal: true, timestamp: 1 },
        { id: 'c', text: 'Salut', isLocal: true, timestamp: 2 },
      ])
    ).toEqual([
      { seq: 0, speaker: 'examiner', text: 'Bonjour' },
      { seq: 2, speaker: 'candidate', text: 'Salut' },
    ]);
  });
});

describe('useRealtimeExam', () => {
  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useRealtimeExam())).toThrow(
      'useRealtimeExam must be used within RealtimeExamProvider'
    );
  });
});

describe('start (OpenAI)', () => {
  it('goes from idle to connecting to connected', async () => {
    let resolveSession!: (data: CreateExamSessionOutput) => void;
    mockedApi.createExamSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      })
    );
    const { result } = renderProvider();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);

    act(() => {
      void result.current.start('tache1');
    });
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.isConnected).toBe(false);

    await act(async () => {
      resolveSession(sessionData());
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isConnecting).toBe(false);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.attemptId).toBe(ATTEMPT);
    expect(result.current.sessionId).toBe('sess-1');
    expect(result.current.mode).toBe('practice');
    expect(result.current.exerciseData?.description).toBe('Présentez-vous');
    expect(result.current.timeUpAt).toBe(NOW + 120_000);
  });

  it('creates the session, connects with the client secret and greets the candidate', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    expect(mockedApi.createExamSession).toHaveBeenCalledWith({
      taskType: 'tache1',
      exerciseId: undefined,
      mode: 'practice',
      runId: undefined,
    });
    const session = lastSession();
    expect(session.connect).toHaveBeenCalledWith({
      apiKey: 'secret-1',
      model: 'gpt-realtime-mini',
    });
    expect(session.options.model).toBe('gpt-realtime-mini');
    expect(session.sendMessage).toHaveBeenCalledWith({
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: START_MESSAGE }],
    });
    const agent = FakeAgent.instances[0].config;
    expect(agent.instructions).toContain('Tu es examinateur.');
    expect(agent.instructions).toContain('Bonjour !');
    expect(agent.voice).toBe('alloy');
    expect(agent.tools.map((t) => t.name)).toEqual(['finSession', 'recommencerTest']);
  });

  it('transcribes the candidate in French and waits patiently before taking the turn', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    expect(lastSession().options.config?.audio?.input).toEqual({
      noiseReduction: { type: 'near_field' },
      transcription: { model: 'gpt-4o-mini-transcribe', language: 'fr' },
      turnDetection: { type: 'semantic_vad', eagerness: 'low' },
    });
  });

  it('describes when the examiner may call each exam tool', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    expect(tool('finSession').description).toBe(FIN_SESSION_DESCRIPTION);
    expect(tool('recommencerTest').description).toBe(RECOMMENCER_TEST_DESCRIPTION);
  });

  it('opens the microphone muted', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    expect(track.enabled).toBe(false);
    expect(result.current.micEnabled).toBe(false);

    act(() => result.current.setMicEnabled(true));
    expect(track.enabled).toBe(true);
    expect(result.current.micEnabled).toBe(true);
  });

  it('keeps the URL on the task and subject being practised', async () => {
    mockedApi.createExamSession.mockResolvedValue(
      sessionData({
        exerciseData: { title: 'T3', description: 'Sujet', taskType: 'tache3', exerciseId: 'ex-9' },
        orderedExerciseIds: ['ex-1', 'ex-9'],
      })
    );
    const { result } = renderProvider();
    await startTask(result, 'tache3', 'ex-9');
    expect(window.location.pathname).toBe('/tcf/tache3/ex-9');
    expect(result.current.orderedExerciseIds).toEqual(['ex-1', 'ex-9']);
  });

  it('ignores a second start while connected', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    await startTask(result, 'tache1');
    expect(mockedApi.createExamSession).toHaveBeenCalledTimes(1);
  });

  it('starts recording only with consent and available storage', async () => {
    mockedApi.getAudioStatus.mockResolvedValue({ available: true, consent: true });
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    await flush();
    expect(FakeRecorder.instances[0].start).toHaveBeenCalledTimes(1);
  });

  it.each([
    { available: true, consent: false },
    { available: false, consent: true },
  ])('does not record when %o', async (status) => {
    mockedApi.getAudioStatus.mockResolvedValue(status);
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    await flush();
    expect(FakeRecorder.instances[0].start).not.toHaveBeenCalled();
  });
});

describe('preparation (tâche 2)', () => {
  beforeEach(() => {
    mockedApi.createExamSession.mockResolvedValue(
      sessionData({
        exerciseData: { title: 'T2', description: 'Situation', taskType: 'tache2' },
      })
    );
  });

  it('counts the preparation down, then refreshes the token right before connecting', async () => {
    const { result } = renderProvider();
    act(() => {
      void result.current.start('tache2');
    });
    await flush();

    expect(result.current.preparation).toEqual({ secondsLeft: 120 });
    expect(result.current.isConnecting).toBe(true);
    await advance(1000);
    expect(result.current.preparation).toEqual({ secondsLeft: 119 });
    await advance(118_000);
    expect(result.current.preparation).toEqual({ secondsLeft: 1 });
    expect(mockedApi.refreshSessionToken).not.toHaveBeenCalled();
    expect(FakeRealtimeSession.instances).toHaveLength(0);

    await advance(1000);

    expect(result.current.preparation).toBeNull();
    expect(mockedApi.refreshSessionToken).toHaveBeenCalledWith(ATTEMPT);
    const session = lastSession();
    expect(session.connect).toHaveBeenCalledWith({
      apiKey: 'fresh-secret',
      model: 'gpt-realtime-mini',
    });
    expect(mockedApi.refreshSessionToken.mock.invocationCallOrder[0]).toBeLessThan(
      session.connect.mock.invocationCallOrder[0]
    );
    expect(result.current.isConnected).toBe(true);
    expect(result.current.timeUpAt).toBe(Date.now() + 210_000);
  });

  it('skipPreparation connects at once', async () => {
    const { result } = renderProvider();
    act(() => {
      void result.current.start('tache2');
    });
    await flush();

    act(() => result.current.skipPreparation());
    await flush();

    expect(result.current.preparation).toBeNull();
    expect(mockedApi.refreshSessionToken).toHaveBeenCalledTimes(1);
    expect(result.current.isConnected).toBe(true);
  });

  it('end() during the preparation cancels the connection', async () => {
    const { result } = renderProvider();
    act(() => {
      void result.current.start('tache2');
    });
    await flush();

    act(() => result.current.end());
    await flush();

    expect(result.current.preparation).toBeNull();
    expect(mockedApi.refreshSessionToken).not.toHaveBeenCalled();
    expect(FakeRealtimeSession.instances).toHaveLength(0);
    expect(result.current.isConnected).toBe(false);
  });
});

describe('end of the task (finSession)', () => {
  it('saves the attempt once, mutes the mic and closes the session after the farewell', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    act(() => result.current.setMicEnabled(true));
    emitHistory();

    let next = '';
    act(() => {
      next = tool('finSession').execute();
    });
    await flush();

    expect(next).toContain('au revoir');
    expect(result.current.sessionEnded).toBe(true);
    expect(result.current.micEnabled).toBe(false);
    expect(track.enabled).toBe(false);
    expect(result.current.attemptCompleted).toBe(true);
    expect(mockedApi.completeAttempt).toHaveBeenCalledTimes(1);
    expect(mockedApi.completeAttempt).toHaveBeenCalledWith(
      { attemptId: ATTEMPT, lines: EXPECTED_LINES },
      { keepalive: undefined }
    );
    expect(lastSession().close).not.toHaveBeenCalled();

    await advance(5999);
    expect(lastSession().close).not.toHaveBeenCalled();
    await advance(1);
    expect(lastSession().close).toHaveBeenCalledTimes(1);
    expect(mockedApi.completeAttempt).toHaveBeenCalledTimes(1);

    await act(() => result.current.finishTask());
    act(() => result.current.end());
    expect(mockedApi.completeAttempt).toHaveBeenCalledTimes(1);
  });

  it('sends the token usage reported by the model', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();
    act(() => {
      lastSession().emit('transport_event', {
        type: 'response.done',
        response: { usage: { input_tokens: 100, output_tokens: 40 } },
      });
      lastSession().emit('transport_event', {
        type: 'response.done',
        response: { usage: { input_tokens: 5 } },
      });
      lastSession().emit('transport_event', { type: 'response.done', response: {} });
    });

    await act(() => result.current.finishTask());

    expect(mockedApi.completeAttempt).toHaveBeenCalledWith(
      { attemptId: ATTEMPT, lines: EXPECTED_LINES, usage: { inputTokens: 105, outputTokens: 40 } },
      { keepalive: undefined }
    );
  });

  it('deletes the attempt instead of saving it when the candidate never spoke', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory([HISTORY[0]]);

    await act(() => result.current.finishTask());

    expect(mockedApi.deleteAttempt).toHaveBeenCalledWith(ATTEMPT);
    expect(mockedApi.completeAttempt).not.toHaveBeenCalled();
    expect(result.current.attemptCompleted).toBe(false);
    expect(FakeRecorder.instances[0].discard).toHaveBeenCalled();
  });

  it('tells the candidate when the attempt could not be saved', async () => {
    mockedApi.completeAttempt.mockRejectedValue(new Error('500'));
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();

    await act(() => result.current.finishTask());

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Impossible d'enregistrer la tentative" })
    );
  });
});

describe('recording upload', () => {
  const upload = {
    url: 'https://bucket.example/upload',
    fields: { key: 'audio/a.webm', policy: 'p' },
    contentType: 'audio/webm',
    maxBytes: 10,
  };

  beforeEach(() => {
    FakeRecorder.recording = { blob: new Blob(['abc']), contentType: 'audio/webm' };
    mockedApi.getAudioUploadUrl.mockResolvedValue(upload);
    mockedApi.confirmAudioUpload.mockResolvedValue({ ok: true });
  });

  async function finishWithSpeech(fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();
    await act(() => result.current.finishTask());
    await flush();
    return result;
  }

  it('posts the presigned fields then the file, and confirms the upload', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    await finishWithSpeech(fetchMock);

    expect(mockedApi.getAudioUploadUrl).toHaveBeenCalledWith({
      attemptId: ATTEMPT,
      contentType: 'audio/webm',
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(upload.url);
    expect(init.method).toBe('POST');
    expect([...(init.body as FormData).keys()]).toEqual(['key', 'policy', 'file']);
    expect(mockedApi.confirmAudioUpload).toHaveBeenCalledWith(ATTEMPT);
  });

  it('skips a recording larger than the presigned limit', async () => {
    mockedApi.getAudioUploadUrl.mockResolvedValue({ ...upload, maxBytes: 2 });
    const fetchMock = vi.fn();
    await finishWithSpeech(fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockedApi.confirmAudioUpload).not.toHaveBeenCalled();
  });

  it('uploads a recording of exactly the limit', async () => {
    mockedApi.getAudioUploadUrl.mockResolvedValue({ ...upload, maxBytes: 3 });
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    await finishWithSpeech(fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not confirm a failed upload, and never fails the attempt', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 403 })));
    const result = await finishWithSpeech(fetchMock);
    expect(mockedApi.confirmAudioUpload).not.toHaveBeenCalled();
    expect(result.current.attemptCompleted).toBe(true);
    expect(toast).not.toHaveBeenCalled();
  });

  it('swallows upload errors', async () => {
    mockedApi.getAudioUploadUrl.mockRejectedValue(new Error('no storage'));
    const fetchMock = vi.fn();
    await finishWithSpeech(fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('uploads nothing when nothing was recorded', async () => {
    FakeRecorder.recording = null;
    const fetchMock = vi.fn();
    await finishWithSpeech(fetchMock);
    expect(mockedApi.getAudioUploadUrl).not.toHaveBeenCalled();
  });
});

describe('end()', () => {
  it('resets the state and saves the attempt with keepalive, dropping the recording', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();
    const session = lastSession();
    const recorder = FakeRecorder.instances[0];

    act(() => result.current.end());
    await flush();

    expect(mockedApi.completeAttempt).toHaveBeenCalledWith(
      { attemptId: ATTEMPT, lines: EXPECTED_LINES },
      { keepalive: true }
    );
    expect(recorder.stop).not.toHaveBeenCalled();
    expect(recorder.discard).toHaveBeenCalled();
    expect(mockedApi.getAudioUploadUrl).not.toHaveBeenCalled();
    expect(session.close).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    expect(audioContexts[0].close).toHaveBeenCalled();

    expect(result.current).toMatchObject({
      isConnected: false,
      isConnecting: false,
      attemptId: null,
      runId: null,
      sessionId: null,
      exerciseData: null,
      transcripts: [],
      orderedExerciseIds: [],
      timeUpAt: null,
      attemptCompleted: false,
      sessionClosed: false,
      sessionEnded: false,
      micEnabled: false,
      fatalError: null,
      sessionError: null,
    });
  });

  it('drops the attempt created after the candidate already left', async () => {
    let resolveSession!: (data: CreateExamSessionOutput) => void;
    mockedApi.createExamSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      })
    );
    const { result } = renderProvider();
    act(() => {
      void result.current.start('tache1');
    });
    act(() => result.current.end());

    await act(async () => {
      resolveSession(sessionData());
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockedApi.deleteAttempt).toHaveBeenCalledWith(ATTEMPT);
    expect(FakeRealtimeSession.instances).toHaveLength(0);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
  });

  it('ends the session on unmount', async () => {
    const { result, unmount } = renderProvider();
    await startTask(result, 'tache1');
    const session = lastSession();
    unmount();
    expect(session.close).toHaveBeenCalled();
  });
});

describe('connection errors', () => {
  it('asks for a provider key when none is configured', async () => {
    mockedApi.createExamSession.mockRejectedValue(
      new ApiError('PROVIDER_NOT_CONFIGURED', 400, 'Aucune clé API configurée.')
    );
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    expect(result.current.needsProviderKey).toBe(true);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.isConnected).toBe(false);
  });

  // The fatal-error toast and the full exam's return to the intro screen both read
  // `fatalError` after a failed start.
  it('keeps the error message after a failed start so the UI can show it', async () => {
    mockedApi.createExamSession.mockRejectedValue(
      new ApiError('NETWORK', 0, 'Impossible de joindre le serveur.')
    );
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    expect(result.current.fatalError).toBe('Impossible de joindre le serveur.');
    expect(result.current.isConnected).toBe(false);
  });

  it('does not ask for a key on other errors', async () => {
    mockedApi.createExamSession.mockRejectedValue(new ApiError('LIMIT', 429, 'Limite atteinte'));
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    expect(result.current.needsProviderKey).toBe(false);
  });

  it('releases the microphone when the realtime connection fails', async () => {
    FakeRealtimeSession.connectResult = () => Promise.reject(new Error('WebRTC failed'));
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    expect(track.stop).toHaveBeenCalled();
    expect(lastSession().close).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
  });

  it('shows session errors from the realtime session', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    const cases: [unknown, string][] = [
      [{ error: new Error('Coupure') }, 'Coupure'],
      [{ error: 'Quota dépassé' }, 'Quota dépassé'],
      [new Error('Brut'), 'Brut'],
      ['Texte', 'Texte'],
      [{ error: 42 }, 'Erreur Realtime'],
    ];
    for (const [payload, message] of cases) {
      act(() => lastSession().emit('error', payload));
      expect(result.current.sessionError).toBe(message);
    }
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Erreur pendant la session' })
    );
  });

  it('turns transport errors into a fatal error', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    act(() => lastSession().emit('transport_event', { type: 'error', error: 'ICE failed' }));
    expect(result.current.fatalError).toBe('ICE failed');
    act(() =>
      lastSession().emit('transport_event', { type: 'error', error: new Error('Socket closed') })
    );
    expect(result.current.fatalError).toBe('Socket closed');
    act(() => lastSession().emit('transport_event', { type: 'error' }));
    expect(result.current.fatalError).toBe('Erreur Realtime');
  });
});

describe('transcript', () => {
  it('maps the session history to transcript lines', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();
    expect(result.current.transcripts.map((l) => [l.text, l.isLocal])).toEqual([
      ['Bonjour, présentez-vous.', false],
      ['Je m’appelle Ana.', true],
    ]);
  });

  it('shows the examiner text while it streams, before the history has it', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    act(() => {
      lastSession().emit('transport_event', {
        type: 'response.output_audio_transcript.delta',
        item_id: 'i9',
        delta: 'Bonjour',
      });
      lastSession().emit('transport_event', {
        type: 'response.output_text.delta',
        item_id: 'i9',
        delta: ' et bienvenue',
      });
      lastSession().emit('transport_event', {
        type: 'response.output_text.delta',
        item_id: 42,
        delta: 'ignoré',
      });
    });
    expect(result.current.transcripts.map((l) => l.text)).toEqual(['Bonjour et bienvenue']);
  });

  it('ignores events from a session that has been replaced', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    const old = lastSession();
    act(() => result.current.end());

    act(() => {
      old.emit('history_updated', HISTORY);
      old.emit('error', 'ancienne');
      old.emit('transport_event', { type: 'error', error: 'ancienne' });
    });
    expect(result.current.transcripts).toEqual([]);
    expect(result.current.sessionError).toBeNull();
    expect(result.current.fatalError).toBeNull();
  });
});

describe('autosave checkpoints', () => {
  it('saves the transcript 10 s after it changes', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();

    await advance(9999);
    expect(mockedApi.checkpointAttempt).not.toHaveBeenCalled();
    await advance(1);
    expect(mockedApi.checkpointAttempt).toHaveBeenCalledWith(
      { attemptId: ATTEMPT, lines: EXPECTED_LINES },
      {}
    );
    expect(result.current.isConnected).toBe(true);
    expect(mockedApi.completeAttempt).not.toHaveBeenCalled();
  });

  it('finishes the task when the usage limit is reached', async () => {
    mockedApi.checkpointAttempt.mockResolvedValue({ ok: true, limitReached: true });
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();

    await advance(10_000);
    await flush();

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Limite d’utilisation atteinte' })
    );
    expect(mockedApi.completeAttempt).toHaveBeenCalledTimes(1);
    expect(lastSession().close).toHaveBeenCalled();
    expect(result.current.attemptCompleted).toBe(true);
  });

  it('saves with keepalive when the page is hidden, but never the same transcript twice', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await flush();
    expect(mockedApi.checkpointAttempt).toHaveBeenCalledWith(
      { attemptId: ATTEMPT, lines: EXPECTED_LINES },
      { keepalive: true }
    );

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await advance(10_000);
    expect(mockedApi.checkpointAttempt).toHaveBeenCalledTimes(1);
  });

  it('retries the same transcript after a failed checkpoint', async () => {
    mockedApi.checkpointAttempt.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await flush();
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await flush();

    expect(mockedApi.checkpointAttempt).toHaveBeenCalledTimes(2);
  });

  it('does not save an empty transcript or a finished attempt', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    emitHistory();
    await act(() => result.current.finishTask());
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await advance(10_000);
    expect(mockedApi.checkpointAttempt).not.toHaveBeenCalled();
  });
});

describe('time up', () => {
  it('only warns in practice mode', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();

    act(() => result.current.onTimeUp());
    await advance(20_000);

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Temps écoulé' }));
    expect(mockedApi.completeAttempt).not.toHaveBeenCalled();
    expect(lastSession().sendMessage).toHaveBeenCalledTimes(1);
  });

  it('lets the examiner close the task, then finishes it, in exam mode', async () => {
    mockedApi.createExamSession.mockResolvedValue(sessionData({ runId: RUN }));
    const { result } = renderProvider();
    await startTask(result, 'tache1', undefined, { mode: 'full' });
    act(() => result.current.setMicEnabled(true));
    emitHistory();

    act(() => result.current.onTimeUp());

    const sent = lastSession().sendMessage.mock.calls.at(-1)?.[0] as {
      content: { text: string }[];
    };
    expect(sent.content[0].text).toContain('Le temps imparti pour cette tâche est écoulé');
    expect(sent).toEqual({
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: TIME_UP_MESSAGE }],
    });
    expect(result.current.micEnabled).toBe(false);
    expect(track.enabled).toBe(false);
    expect(toast).not.toHaveBeenCalled();

    await advance(9999);
    expect(mockedApi.completeAttempt).not.toHaveBeenCalled();
    await advance(1);
    expect(mockedApi.completeAttempt).toHaveBeenCalledTimes(1);
    expect(lastSession().close).toHaveBeenCalled();
  });

  it('does nothing once the attempt is saved', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    emitHistory();
    await act(() => result.current.finishTask());
    toast.mockReset();

    act(() => result.current.onTimeUp());
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('restart and exercise navigation', () => {
  it('restartExam keeps the full-exam mode and run id', async () => {
    mockedApi.createExamSession
      .mockResolvedValueOnce(sessionData({ runId: RUN }))
      .mockResolvedValueOnce(sessionData({ runId: RUN, attemptId: ATTEMPT_2 }));
    const { result } = renderProvider();
    await startTask(result, 'tache1', undefined, { mode: 'full', runId: RUN });
    const first = lastSession();

    await act(() => result.current.restartExam());

    expect(first.close).toHaveBeenCalled();
    expect(mockedApi.deleteAttempt).toHaveBeenCalledWith(ATTEMPT);
    expect(mockedApi.createExamSession).toHaveBeenLastCalledWith({
      taskType: 'tache1',
      exerciseId: undefined,
      mode: 'full',
      runId: RUN,
    });
    expect(result.current.mode).toBe('full');
    expect(result.current.runId).toBe(RUN);
    expect(result.current.attemptId).toBe(ATTEMPT_2);
    expect(result.current.restartSequence).toBe(1);
    expect(result.current.isRestarting).toBe(false);
    expect(result.current.isConnected).toBe(true);
  });

  it('restartExam stays in practice without a run id', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1', 'ex-1');
    await act(() => result.current.restartExam());
    expect(mockedApi.createExamSession).toHaveBeenLastCalledWith({
      taskType: 'tache1',
      exerciseId: 'ex-1',
      mode: 'practice',
      runId: undefined,
    });
  });

  it('shows the restart in progress', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    mockedApi.createExamSession.mockReturnValue(new Promise(() => undefined));

    act(() => {
      void result.current.restartExam();
    });
    expect(result.current.isRestarting).toBe(true);
    expect(result.current.restartSequence).toBe(1);
  });

  it('the recommencerTest tool restarts the exam', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    let next = '';
    act(() => {
      next = tool('recommencerTest').execute();
    });
    await flush();

    expect(next).toContain('réinitialisée');
    expect(mockedApi.createExamSession).toHaveBeenCalledTimes(2);
    expect(result.current.restartSequence).toBe(1);
  });

  it('restartExam does nothing before any task', async () => {
    const { result } = renderProvider();
    await act(() => result.current.restartExam());
    expect(mockedApi.createExamSession).not.toHaveBeenCalled();
  });

  it('goToAnotherExercise walks the subject list and keeps the run', async () => {
    mockedApi.createExamSession.mockImplementation((input) =>
      Promise.resolve(
        sessionData({
          runId: RUN,
          exerciseData: {
            title: 'T3',
            description: 'Sujet',
            taskType: 'tache3',
            exerciseId: input.exerciseId,
          },
          orderedExerciseIds: ['a', 'b', 'c'],
        })
      )
    );
    const { result } = renderProvider();
    await startTask(result, 'tache3', 'b', { mode: 'full', runId: RUN });

    await act(() => result.current.goToAnotherExercise('next'));
    expect(mockedApi.createExamSession).toHaveBeenLastCalledWith({
      taskType: 'tache3',
      exerciseId: 'c',
      mode: 'full',
      runId: RUN,
    });

    await act(() => result.current.goToAnotherExercise('previous'));
    expect(mockedApi.createExamSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ exerciseId: 'b' })
    );

    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await act(() => result.current.goToAnotherExercise('random'));
    expect(mockedApi.createExamSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ exerciseId: 'c', mode: 'full', runId: RUN })
    );
    expect(result.current.restartSequence).toBe(3);
    expect(window.location.pathname).toBe('/tcf/tache3/c');
  });

  it('goToAnotherExercise does nothing without a subject list', async () => {
    const { result } = renderProvider();
    await act(() => result.current.goToAnotherExercise('next'));
    await startTask(result, 'tache1');
    await act(() => result.current.goToAnotherExercise('next'));
    expect(mockedApi.createExamSession).toHaveBeenCalledTimes(1);
  });
});

describe('voice activity', () => {
  it('reports the candidate speaking above the threshold', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    micLevel = 128 + 21;
    act(() => {
      frames.shift()?.(0);
    });
    expect(result.current.userSpeaking).toBe(true);
    expect(result.current.userAudioLevelRef.current).toBeCloseTo(21 / 22);

    micLevel = 128 + 20;
    act(() => {
      frames.shift()?.(0);
    });
    expect(result.current.userSpeaking).toBe(false);

    micLevel = 128 + 60;
    act(() => {
      frames.shift()?.(0);
    });
    expect(result.current.userAudioLevelRef.current).toBe(1);
  });

  it('reports the examiner speaking once the remote audio arrives', async () => {
    const createElement = vi.spyOn(document, 'createElement');
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    const audio = createElement.mock.results
      .map((r) => r.value as HTMLElement)
      .find((el) => el.tagName === 'AUDIO');
    expect(audio).toBeDefined();
    frames = [];

    await advance(400);
    expect(frames).toHaveLength(0);

    Object.defineProperty(audio, 'srcObject', {
      configurable: true,
      value: { getAudioTracks: () => [{}] },
    });
    await advance(200);
    micLevel = 128 + 11;
    act(() => {
      frames.shift()?.(0);
    });
    expect(result.current.agentSpeaking).toBe(true);
    expect(result.current.agentAudioLevelRef.current).toBeCloseTo(11 / 18);

    micLevel = 128 + 10;
    act(() => {
      frames.shift()?.(0);
    });
    expect(result.current.agentSpeaking).toBe(false);
  });
});

describe('Gemini Live', () => {
  beforeEach(() => {
    mockedApi.createExamSession.mockResolvedValue(
      sessionData({
        provider: 'gemini',
        agentConfig: {
          instructions: 'Tu es examinateur.',
          greeting: 'Bonjour !',
          voice: 'Kore',
          model: 'gemini-live',
          allowInterruptions: true,
        },
      })
    );
  });

  const LINES = [
    { id: 'g0', text: 'Bonjour.', isLocal: false, timestamp: 0 },
    { id: 'g1', text: 'Bonjour madame.', isLocal: true, timestamp: 1 },
  ];

  it('connects with the token and starts the exam', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');

    const gemini = lastGemini();
    expect(gemini.opts).toMatchObject({ token: 'secret-1', model: 'gemini-live', voice: 'Kore' });
    expect(gemini.opts.instructions).toContain('Bonjour !');
    expect(gemini.connect).toHaveBeenCalled();
    expect(gemini.sendText).toHaveBeenCalledWith(START_MESSAGE);
    expect(FakeRealtimeSession.instances).toHaveLength(0);
    expect(track.enabled).toBe(false);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.timeUpAt).toBe(NOW + 120_000);
  });

  it('marks the session closed and saves the attempt when the connection drops', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    const { opts } = lastGemini();
    act(() => {
      opts.onLines(LINES);
      opts.onUsage({ inputTokens: 7, outputTokens: 3 });
    });
    expect(result.current.transcripts).toEqual(LINES);

    act(() => opts.onClose());
    await flush();

    expect(result.current.sessionClosed).toBe(true);
    expect(result.current.isConnected).toBe(false);
    expect(mockedApi.completeAttempt).toHaveBeenCalledWith(
      {
        attemptId: ATTEMPT,
        lines: [
          { seq: 0, speaker: 'examiner', text: 'Bonjour.' },
          { seq: 1, speaker: 'candidate', text: 'Bonjour madame.' },
        ],
        usage: { inputTokens: 7, outputTokens: 3 },
      },
      { keepalive: undefined }
    );
  });

  it('finSession saves once and closes after the farewell', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    const gemini = lastGemini();
    act(() => gemini.opts.onLines(LINES));

    act(() => gemini.opts.onTool('finSession'));
    await flush();
    expect(result.current.sessionEnded).toBe(true);
    expect(mockedApi.completeAttempt).toHaveBeenCalledTimes(1);

    await advance(6000);
    expect(gemini.close).toHaveBeenCalled();
    expect(mockedApi.completeAttempt).toHaveBeenCalledTimes(1);
  });

  it('recommencerTest restarts the exam', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    act(() => lastGemini().opts.onTool('recommencerTest'));
    await flush();
    expect(mockedApi.createExamSession).toHaveBeenCalledTimes(2);
    expect(FakeGemini.instances).toHaveLength(2);
  });

  it('shows provider errors', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    act(() => lastGemini().opts.onError('Jeton expiré'));
    expect(result.current.sessionError).toBe('Jeton expiré');
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Erreur pendant la session' })
    );
  });

  it('sends the time-up message in exam mode', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1', undefined, { mode: 'full' });
    act(() => result.current.onTimeUp());
    expect(lastGemini().sendText).toHaveBeenLastCalledWith(
      expect.stringContaining('Le temps imparti pour cette tâche est écoulé')
    );
    expect(lastGemini().sendText).toHaveBeenLastCalledWith(TIME_UP_MESSAGE);
  });

  it('ignores callbacks of a closed session', async () => {
    const { result } = renderProvider();
    await startTask(result, 'tache1');
    const { opts } = lastGemini();
    act(() => result.current.end());

    act(() => {
      opts.onLines(LINES);
      opts.onError('ancienne');
      opts.onClose();
    });
    expect(result.current.transcripts).toEqual([]);
    expect(result.current.sessionError).toBeNull();
    expect(result.current.sessionClosed).toBe(false);
  });

  it('closes a session that finished connecting after the candidate left', async () => {
    let resolveConnect!: () => void;
    FakeGemini.connectResult = () =>
      new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });
    const { result } = renderProvider();
    act(() => {
      void result.current.start('tache1');
    });
    await flush();
    const gemini = lastGemini();
    act(() => result.current.end());

    await act(async () => {
      resolveConnect();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(gemini.close).toHaveBeenCalledTimes(2);
    expect(gemini.sendText).not.toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });

  it('stops the microphone when the candidate left before it opened', async () => {
    let resolveMic!: (s: unknown) => void;
    const stoppable = { enabled: true, stop: vi.fn() };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(
          () =>
            new Promise((resolve) => {
              resolveMic = resolve;
            })
        ),
      },
    });
    const { result } = renderProvider();
    act(() => {
      void result.current.start('tache1');
    });
    await flush();
    act(() => result.current.end());

    await act(async () => {
      resolveMic({ getAudioTracks: () => [stoppable], getTracks: () => [stoppable] });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(stoppable.stop).toHaveBeenCalled();
    expect(FakeGemini.instances).toHaveLength(0);
  });
});

describe('full exam with the real provider', () => {
  it('goes back to the intro screen and reports the error when a task fails to start', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    mockedApi.createExamSession.mockRejectedValue(
      new ApiError('NETWORK', 0, 'Impossible de joindre le serveur.')
    );
    render(<ExamRunApp />);

    fireEvent.click(screen.getByRole('button', { name: "Commencer l'examen" }));
    await flush();

    expect(mockedApi.createExamSession).toHaveBeenCalledWith(
      expect.objectContaining({ taskType: 'tache1', mode: 'full' })
    );
    expect(screen.getByRole('heading', { name: 'Examen complet' })).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Connexion à l’examinateur…' })
    ).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Session impossible' }));
  });
});
