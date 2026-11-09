import type { ExamTranscriptLine } from '@/lib/transcript-from-history';

/** Float samples [-1, 1] → little-endian PCM16 → base64 (Gemini Live input). */
export function floatToPcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Base64 little-endian PCM16 → float samples (Gemini Live output, 24 kHz). */
export function pcm16Base64ToFloat(base64: string): Float32Array {
  const binary = atob(base64);
  const out = new Float32Array(Math.floor(binary.length / 2));
  for (let i = 0; i < out.length; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    const v = (hi << 8) | lo;
    out[i] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
  }
  return out;
}

/**
 * Builds transcript lines from Gemini's incremental input/output transcription
 * chunks. A new line starts whenever the speaker changes or a turn ends.
 */
export class TurnTranscript {
  private lines: ExamTranscriptLine[] = [];
  private open: 'input' | 'output' | null = null;
  private counter = 0;

  constructor(private readonly now: () => number = Date.now) {}

  private append(kind: 'input' | 'output', text: string): void {
    if (!text) return;
    const last = this.lines[this.lines.length - 1];
    if (this.open === kind && last) {
      this.lines[this.lines.length - 1] = { ...last, text: last.text + text };
      return;
    }
    this.open = kind;
    this.lines.push({
      id: `gemini-${kind}-${this.counter++}`,
      text: text.trimStart(),
      isLocal: kind === 'input',
      timestamp: this.now(),
    });
  }

  addInput(text: string): void {
    this.append('input', text);
  }
  addOutput(text: string): void {
    this.append('output', text);
  }
  /** Turn finished or interrupted: the next chunk opens a new line. */
  endTurn(): void {
    this.open = null;
  }
  snapshot(): ExamTranscriptLine[] {
    return this.lines.map((l) => ({ ...l, text: l.text.trim() }));
  }
}
