import type { GeminiLiveOptions } from '@/lib/gemini-live';
import type { ExamTranscriptLine } from '@/lib/transcript-from-history';

/** Prefix of the client secret the API mints with VOICE_PROVIDER=fake. */
export const FAKE_CLIENT_SECRET_PREFIX = 'fake-client-secret';

/**
 * End-to-end test mode only: a build with NEXT_PUBLIC_FAKE_VOICE=true talks to
 * FakeLiveSession instead of OpenAI/Gemini when the API hands out a fake secret.
 */
export function isFakeVoice(clientSecret: string): boolean {
  return (
    process.env.NEXT_PUBLIC_FAKE_VOICE === 'true' &&
    clientSecret.startsWith(FAKE_CLIENT_SECRET_PREFIX)
  );
}

/** The scripted exchange: examiner, candidate, examiner farewell, then finSession. */
export const FAKE_SCRIPT: { text: string; isLocal: boolean }[] = [
  { text: 'Bonjour, je suis votre examinateur. Commençons la tâche.', isLocal: false },
  { text: 'Bonjour, je voudrais des informations sur les horaires du club.', isLocal: true },
  { text: 'Merci, la tâche est terminée. Au revoir.', isLocal: false },
];

const READY_PREFIX = 'Le candidat est prêt';

/**
 * Same surface as GeminiLiveSession (connect, sendText, close, callbacks), with
 * no network or audio: once told the candidate is ready, it plays FAKE_SCRIPT
 * line by line, then calls the finSession tool.
 */
export class FakeLiveSession {
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private closed = false;
  private started = false;

  constructor(
    private readonly opts: GeminiLiveOptions,
    private readonly stepMs = 400
  ) {}

  connect(): Promise<void> {
    return Promise.resolve();
  }

  sendText(text: string): void {
    if (this.closed || this.started || !text.startsWith(READY_PREFIX)) return;
    this.started = true;
    const lines: ExamTranscriptLine[] = [];
    FAKE_SCRIPT.forEach((line, i) => {
      this.timers.push(
        setTimeout(
          () => {
            if (this.closed) return;
            lines.push({
              id: `fake-${i}`,
              text: line.text,
              isLocal: line.isLocal,
              timestamp: Date.now(),
            });
            this.opts.onAgentSpeaking(!line.isLocal);
            this.opts.onLines([...lines]);
          },
          this.stepMs * (i + 1)
        )
      );
    });
    this.timers.push(
      setTimeout(
        () => {
          if (this.closed) return;
          this.opts.onAgentSpeaking(false);
          this.opts.onUsage({ inputTokens: 100, outputTokens: 50 });
          this.opts.onTool('finSession');
        },
        this.stepMs * (FAKE_SCRIPT.length + 1)
      )
    );
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.opts.onAgentSpeaking(false);
    this.opts.onClose();
  }
}
