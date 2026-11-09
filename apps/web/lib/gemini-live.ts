import { GoogleGenAI, type LiveServerMessage, Modality, type Session } from '@google/genai';
import { TurnTranscript, floatToPcm16Base64, pcm16Base64ToFloat } from '@/lib/live-audio';
import type { ExamTranscriptLine } from '@/lib/transcript-from-history';

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

const WORKLET_SOURCE = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('capture', Capture);
`;

export interface GeminiLiveOptions {
  token: string;
  model: string;
  voice: string;
  instructions: string;
  stream: MediaStream;
  onLines(lines: ExamTranscriptLine[]): void;
  onAgentSpeaking(speaking: boolean): void;
  /** Cumulative token counts reported by the server. */
  onUsage(usage: { inputTokens: number; outputTokens: number }): void;
  /** The model called one of the exam tools. */
  onTool(name: 'finSession' | 'recommencerTest'): void;
  onError(message: string): void;
  onClose(): void;
}

/** Browser-side Gemini Live session over WebSocket (ephemeral token). */
export class GeminiLiveSession {
  private session: Session | null = null;
  private inCtx: AudioContext | null = null;
  private outCtx: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private closed = false;
  private readonly transcript = new TurnTranscript();

  constructor(private readonly opts: GeminiLiveOptions) {}

  async connect(): Promise<void> {
    const { opts } = this;
    const ai = new GoogleGenAI({
      apiKey: opts.token,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    this.session = await ai.live.connect({
      model: opts.model,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: opts.instructions,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: opts.voice } } },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [
          {
            functionDeclarations: [
              {
                name: 'finSession',
                description: "À appeler quand l'épreuve est terminée, après avoir dit au revoir.",
              },
              {
                name: 'recommencerTest',
                description: "À appeler si le candidat demande de recommencer l'épreuve.",
              },
            ],
          },
        ],
      },
      callbacks: {
        onmessage: (m) => this.handleMessage(m),
        onerror: (e) => opts.onError(e.message || 'Erreur Gemini Live'),
        onclose: () => {
          if (!this.closed) opts.onClose();
        },
      },
    });

    await this.startCapture();
  }

  private async startCapture(): Promise<void> {
    this.inCtx = new AudioContext({ sampleRate: INPUT_RATE });
    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
    try {
      await this.inCtx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const source = this.inCtx.createMediaStreamSource(this.opts.stream);
    this.worklet = new AudioWorkletNode(this.inCtx, 'capture');
    const track = this.opts.stream.getAudioTracks()[0];
    this.worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
      // The exam UI mutes the track while the candidate must not be heard.
      if (this.closed || !track?.enabled) return;
      this.session?.sendRealtimeInput({
        audio: {
          data: floatToPcm16Base64(e.data),
          mimeType: `audio/pcm;rate=${INPUT_RATE}`,
        },
      });
    };
    source.connect(this.worklet);
  }

  private handleMessage(m: LiveServerMessage): void {
    const content = m.serverContent;
    if (content?.interrupted) {
      this.stopPlayback();
      this.transcript.endTurn();
    }
    for (const part of content?.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (data) this.play(pcm16Base64ToFloat(data));
    }
    if (content?.inputTranscription?.text) {
      this.transcript.addInput(content.inputTranscription.text);
      this.opts.onLines(this.transcript.snapshot());
    }
    if (content?.outputTranscription?.text) {
      this.transcript.addOutput(content.outputTranscription.text);
      this.opts.onLines(this.transcript.snapshot());
    }
    if (content?.turnComplete) this.transcript.endTurn();

    const usage = m.usageMetadata;
    if (usage) {
      this.opts.onUsage({
        inputTokens: usage.promptTokenCount ?? 0,
        outputTokens: usage.responseTokenCount ?? 0,
      });
    }

    const calls = m.toolCall?.functionCalls ?? [];
    if (calls.length > 0) {
      this.session?.sendToolResponse({
        functionResponses: calls.map((c) => ({
          id: c.id,
          name: c.name,
          response: { output: 'ok' },
        })),
      });
      for (const c of calls) {
        if (c.name === 'finSession' || c.name === 'recommencerTest') this.opts.onTool(c.name);
      }
    }
  }

  private play(samples: Float32Array): void {
    this.outCtx ??= new AudioContext({ sampleRate: OUTPUT_RATE });
    const ctx = this.outCtx;
    const buffer = ctx.createBuffer(1, samples.length, OUTPUT_RATE);
    buffer.copyToChannel(new Float32Array(samples), 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    this.nextStart = Math.max(this.nextStart, ctx.currentTime);
    src.start(this.nextStart);
    this.nextStart += buffer.duration;
    this.sources.add(src);
    this.opts.onAgentSpeaking(true);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) this.opts.onAgentSpeaking(false);
    };
  }

  private stopPlayback(): void {
    for (const s of this.sources) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    this.sources.clear();
    this.nextStart = 0;
    this.opts.onAgentSpeaking(false);
  }

  sendText(text: string): void {
    this.session?.sendRealtimeInput({ text });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopPlayback();
    this.worklet?.port.close();
    void this.inCtx?.close().catch(() => undefined);
    void this.outCtx?.close().catch(() => undefined);
    try {
      this.session?.close();
    } catch {
      // already closed
    }
    this.session = null;
  }
}
