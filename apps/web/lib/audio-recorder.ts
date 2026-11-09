import { AUDIO_MAX_BYTES, AUDIO_MIME_TYPES } from '@parle-tcf/shared';

type AudioMime = (typeof AUDIO_MIME_TYPES)[number];

/** First container the browser can record that the API accepts. */
export function pickMimeType(
  isSupported: (type: string) => boolean = (t) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
): AudioMime | null {
  return AUDIO_MIME_TYPES.find((t) => isSupported(t)) ?? null;
}

export interface Recording {
  blob: Blob;
  contentType: AudioMime;
}

/** Records the candidate's microphone for the duration of one attempt. */
export class AttemptRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private contentType: AudioMime | null = null;

  start(stream: MediaStream): boolean {
    const type = pickMimeType();
    if (!type || typeof MediaRecorder === 'undefined') return false;
    try {
      // Record a clone of the audio tracks so muting the mic for the examiner
      // does not truncate the recording logic, and stopping it never ends the call.
      const audioOnly = new MediaStream(stream.getAudioTracks());
      this.recorder = new MediaRecorder(audioOnly, { mimeType: type });
    } catch {
      return false;
    }
    this.contentType = type;
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(5000);
    return true;
  }

  /** Stops and returns the recording, or null if nothing usable was captured. */
  stop(): Promise<Recording | null> {
    const recorder = this.recorder;
    const contentType = this.contentType;
    this.recorder = null;
    if (!recorder || !contentType || recorder.state === 'inactive') {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: contentType });
        this.chunks = [];
        resolve(blob.size > 0 && blob.size <= AUDIO_MAX_BYTES ? { blob, contentType } : null);
      };
      recorder.stop();
    });
  }

  discard(): void {
    const recorder = this.recorder;
    this.recorder = null;
    this.chunks = [];
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
  }
}
