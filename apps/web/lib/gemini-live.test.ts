import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type GeminiLiveOptions, GeminiLiveSession } from './gemini-live';
import { floatToPcm16Base64 } from './live-audio';

interface ConnectArgs {
  model: string;
  config: Record<string, unknown>;
  callbacks: {
    onmessage: (m: unknown) => void;
    onerror: (e: { message: string }) => void;
    onclose: () => void;
  };
}

const genai = vi.hoisted(() => ({
  ctorArgs: [] as unknown[],
  connectArgs: [] as unknown[],
  session: null as null | {
    sendRealtimeInput: Mock;
    sendToolResponse: Mock;
    close: Mock;
  },
}));

vi.mock('@google/genai', () => ({
  Modality: { AUDIO: 'AUDIO' },
  GoogleGenAI: class {
    live = {
      connect: (args: unknown) => {
        genai.connectArgs.push(args);
        return Promise.resolve(genai.session);
      },
    };
    constructor(opts: unknown) {
      genai.ctorArgs.push(opts);
    }
  },
}));

class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  currentTime = 0;
  destination = { kind: 'destination' };
  audioWorklet = { addModule: vi.fn(() => Promise.resolve()) };
  sources: FakeSource[] = [];
  mediaSource = { connect: vi.fn() };
  close = vi.fn(() => Promise.resolve());
  constructor(readonly options: { sampleRate: number }) {
    FakeAudioContext.instances.push(this);
  }
  createMediaStreamSource = vi.fn(() => this.mediaSource);
  createBuffer = vi.fn((_channels: number, length: number, rate: number) => ({
    duration: length / rate,
    copyToChannel: vi.fn(),
  }));
  createBufferSource = vi.fn(() => {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  });
}

class FakeWorkletNode {
  static instances: FakeWorkletNode[] = [];
  port = {
    onmessage: null as ((e: { data: Float32Array }) => void) | null,
    close: vi.fn(),
  };
  constructor(
    readonly ctx: unknown,
    readonly name: string
  ) {
    FakeWorkletNode.instances.push(this);
  }
}

function makeOptions(track = { enabled: true }) {
  const opts = {
    token: 'ephemeral-token',
    model: 'gemini-live-model',
    voice: 'Kore',
    instructions: 'Tu es examinateur.',
    stream: { getAudioTracks: () => [track] } as unknown as MediaStream,
    onLines: vi.fn(),
    onAgentSpeaking: vi.fn(),
    onUsage: vi.fn(),
    onTool: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
  } satisfies GeminiLiveOptions;
  return { opts, track };
}

/** Base64 of 4 PCM16 samples (8 bytes). */
const AUDIO_CHUNK = floatToPcm16Base64(new Float32Array([0, 0.5, -0.5, 0.25]));

async function connected(track?: { enabled: boolean }) {
  const { opts } = makeOptions(track);
  const live = new GeminiLiveSession(opts);
  await live.connect();
  const args = genai.connectArgs.at(-1) as ConnectArgs;
  return { live, opts, args, send: (m: unknown) => args.callbacks.onmessage(m) };
}

beforeEach(() => {
  genai.ctorArgs = [];
  genai.connectArgs = [];
  genai.session = { sendRealtimeInput: vi.fn(), sendToolResponse: vi.fn(), close: vi.fn() };
  FakeAudioContext.instances = [];
  FakeWorkletNode.instances = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('AudioWorkletNode', FakeWorkletNode);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:worklet');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GeminiLiveSession.connect', () => {
  it('opens a v1alpha live session with the token, voice, instructions and the two exam tools', async () => {
    const { args } = await connected();

    expect(genai.ctorArgs[0]).toEqual({
      apiKey: 'ephemeral-token',
      httpOptions: { apiVersion: 'v1alpha' },
    });
    expect(args.model).toBe('gemini-live-model');
    expect(args.config).toMatchObject({
      responseModalities: ['AUDIO'],
      systemInstruction: 'Tu es examinateur.',
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    });
    const tools = args.config.tools as { functionDeclarations: { name: string }[] }[];
    expect(tools[0].functionDeclarations.map((f) => f.name)).toEqual([
      'finSession',
      'recommencerTest',
    ]);
  });

  it('captures the microphone at 16 kHz through an audio worklet and revokes the module URL', async () => {
    await connected();

    const inCtx = FakeAudioContext.instances[0];
    expect(inCtx.options).toEqual({ sampleRate: 16000 });
    expect(inCtx.audioWorklet.addModule).toHaveBeenCalledWith('blob:worklet');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:worklet');
    expect(FakeWorkletNode.instances[0].name).toBe('capture');
    expect(inCtx.mediaSource.connect).toHaveBeenCalledWith(FakeWorkletNode.instances[0]);
  });

  it('revokes the module URL even when the worklet fails to load', async () => {
    const { opts } = makeOptions();
    const live = new GeminiLiveSession(opts);
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        audioWorklet = { addModule: vi.fn(() => Promise.reject(new Error('blocked'))) };
      }
    );

    await expect(live.connect()).rejects.toThrow('blocked');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:worklet');
  });
});

describe('microphone capture', () => {
  it('streams PCM16 chunks while the track is enabled', async () => {
    await connected();
    const samples = new Float32Array([0.1, -0.1]);

    FakeWorkletNode.instances[0].port.onmessage?.({ data: samples });

    expect(genai.session?.sendRealtimeInput).toHaveBeenCalledWith({
      audio: { data: floatToPcm16Base64(samples), mimeType: 'audio/pcm;rate=16000' },
    });
  });

  it('sends nothing while the track is muted', async () => {
    await connected({ enabled: false });
    FakeWorkletNode.instances[0].port.onmessage?.({ data: new Float32Array([0.1]) });
    expect(genai.session?.sendRealtimeInput).not.toHaveBeenCalled();
  });

  it('sends nothing once closed', async () => {
    const { live } = await connected();
    const port = FakeWorkletNode.instances[0].port;
    live.close();
    port.onmessage?.({ data: new Float32Array([0.1]) });
    expect(genai.session?.sendRealtimeInput).not.toHaveBeenCalled();
  });
});

describe('server messages', () => {
  it('builds transcript lines from input and output transcriptions', async () => {
    const { send, opts } = await connected();

    send({ serverContent: { inputTranscription: { text: 'Bonjour' } } });
    expect(opts.onLines).toHaveBeenLastCalledWith([
      expect.objectContaining({ text: 'Bonjour', isLocal: true }),
    ]);

    send({ serverContent: { outputTranscription: { text: 'Bonjour, ' } } });
    send({ serverContent: { outputTranscription: { text: 'asseyez-vous.' }, turnComplete: true } });
    send({ serverContent: { outputTranscription: { text: 'Alors ?' } } });

    const lines = opts.onLines.mock.calls.at(-1)?.[0] as { text: string; isLocal: boolean }[];
    expect(lines.map((l) => [l.text, l.isLocal])).toEqual([
      ['Bonjour', true],
      ['Bonjour, asseyez-vous.', false],
      ['Alors ?', false],
    ]);
  });

  it('ignores empty transcriptions', async () => {
    const { send, opts } = await connected();
    send({ serverContent: { inputTranscription: { text: '' }, outputTranscription: {} } });
    send({});
    expect(opts.onLines).not.toHaveBeenCalled();
  });

  it('reports usage, defaulting missing counts to 0', async () => {
    const { send, opts } = await connected();
    send({ usageMetadata: { promptTokenCount: 120, responseTokenCount: 40 } });
    expect(opts.onUsage).toHaveBeenLastCalledWith({ inputTokens: 120, outputTokens: 40 });
    send({ usageMetadata: {} });
    expect(opts.onUsage).toHaveBeenLastCalledWith({ inputTokens: 0, outputTokens: 0 });
  });

  it('answers every tool call and forwards only the exam tools', async () => {
    const { send, opts } = await connected();

    send({
      toolCall: {
        functionCalls: [
          { id: 'c1', name: 'finSession' },
          { id: 'c2', name: 'autreOutil' },
          { id: 'c3', name: 'recommencerTest' },
        ],
      },
    });

    expect(genai.session?.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [
        { id: 'c1', name: 'finSession', response: { output: 'ok' } },
        { id: 'c2', name: 'autreOutil', response: { output: 'ok' } },
        { id: 'c3', name: 'recommencerTest', response: { output: 'ok' } },
      ],
    });
    expect(opts.onTool.mock.calls).toEqual([['finSession'], ['recommencerTest']]);
  });

  it('does not answer when there is no tool call', async () => {
    const { send } = await connected();
    send({ toolCall: { functionCalls: [] } });
    expect(genai.session?.sendToolResponse).not.toHaveBeenCalled();
  });
});

describe('playback', () => {
  it('queues audio chunks back to back at 24 kHz and reports the examiner speaking', async () => {
    const { send, opts } = await connected();

    send({ serverContent: { modelTurn: { parts: [{ inlineData: { data: AUDIO_CHUNK } }] } } });
    send({ serverContent: { modelTurn: { parts: [{ inlineData: { data: AUDIO_CHUNK } }, {}] } } });

    const outCtx = FakeAudioContext.instances[1];
    expect(outCtx.options).toEqual({ sampleRate: 24000 });
    expect(outCtx.createBuffer).toHaveBeenCalledWith(1, 4, 24000);
    const [first, second] = outCtx.sources;
    expect(first.connect).toHaveBeenCalledWith(outCtx.destination);
    expect(first.start).toHaveBeenCalledWith(0);
    expect(second.start).toHaveBeenCalledWith(4 / 24000);
    expect(opts.onAgentSpeaking).toHaveBeenLastCalledWith(true);

    first.onended?.();
    expect(opts.onAgentSpeaking).toHaveBeenLastCalledWith(true);
    second.onended?.();
    expect(opts.onAgentSpeaking).toHaveBeenLastCalledWith(false);
  });

  it('never schedules in the past', async () => {
    const { send } = await connected();
    send({ serverContent: { modelTurn: { parts: [{ inlineData: { data: AUDIO_CHUNK } }] } } });
    const outCtx = FakeAudioContext.instances[1];
    outCtx.currentTime = 5;
    send({ serverContent: { modelTurn: { parts: [{ inlineData: { data: AUDIO_CHUNK } }] } } });
    expect(outCtx.sources[1].start).toHaveBeenCalledWith(5);
  });

  it('stops playback and closes the open line when interrupted', async () => {
    const { send, opts } = await connected();
    send({ serverContent: { modelTurn: { parts: [{ inlineData: { data: AUDIO_CHUNK } }] } } });
    send({ serverContent: { outputTranscription: { text: 'Je disais' } } });
    const source = FakeAudioContext.instances[1].sources[0];
    source.stop.mockImplementation(() => {
      throw new Error('already stopped');
    });

    send({ serverContent: { interrupted: true } });

    expect(source.stop).toHaveBeenCalled();
    expect(source.onended).toBeNull();
    expect(opts.onAgentSpeaking).toHaveBeenLastCalledWith(false);

    send({ serverContent: { outputTranscription: { text: 'Reprenons' } } });
    const lines = opts.onLines.mock.calls.at(-1)?.[0] as { text: string }[];
    expect(lines.map((l) => l.text)).toEqual(['Je disais', 'Reprenons']);

    send({ serverContent: { modelTurn: { parts: [{ inlineData: { data: AUDIO_CHUNK } }] } } });
    expect(FakeAudioContext.instances[1].sources[1].start).toHaveBeenCalledWith(0);
  });
});

describe('lifecycle', () => {
  it('sendText sends a text turn', async () => {
    const { live } = await connected();
    live.sendText('Le candidat est prêt.');
    expect(genai.session?.sendRealtimeInput).toHaveBeenCalledWith({
      text: 'Le candidat est prêt.',
    });
  });

  it('sendText is a no-op before connecting', () => {
    const live = new GeminiLiveSession(makeOptions().opts);
    expect(() => live.sendText('x')).not.toThrow();
  });

  it('reports server errors, with a default message', async () => {
    const { args, opts } = await connected();
    args.callbacks.onerror({ message: 'quota' });
    args.callbacks.onerror({ message: '' });
    expect(opts.onError.mock.calls).toEqual([['quota'], ['Erreur Gemini Live']]);
  });

  it('reports a close from the server, but not one it initiated', async () => {
    const first = await connected();
    first.args.callbacks.onclose();
    expect(first.opts.onClose).toHaveBeenCalledTimes(1);

    const second = await connected();
    second.live.close();
    second.args.callbacks.onclose();
    expect(second.opts.onClose).not.toHaveBeenCalled();
  });

  it('close() releases audio, the worklet and the session once, even if the session throws', async () => {
    const { live, send } = await connected();
    send({ serverContent: { modelTurn: { parts: [{ inlineData: { data: AUDIO_CHUNK } }] } } });
    const session = genai.session!;
    session.close.mockImplementation(() => {
      throw new Error('already closed');
    });

    expect(() => live.close()).not.toThrow();
    live.close();

    const [inCtx, outCtx] = FakeAudioContext.instances;
    expect(FakeWorkletNode.instances[0].port.close).toHaveBeenCalledTimes(1);
    expect(inCtx.close).toHaveBeenCalledTimes(1);
    expect(outCtx.close).toHaveBeenCalledTimes(1);
    expect(session.close).toHaveBeenCalledTimes(1);
    expect(outCtx.sources[0].stop).toHaveBeenCalled();

    live.sendText('après fermeture');
    expect(session.sendRealtimeInput).not.toHaveBeenCalledWith({ text: 'après fermeture' });
  });

  it('close() before connecting does not throw', () => {
    expect(() => new GeminiLiveSession(makeOptions().opts).close()).not.toThrow();
  });
});
