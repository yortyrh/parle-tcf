import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_MAX_BYTES } from '@parle-tcf/shared';
import { AttemptRecorder, pickMimeType } from './audio-recorder';

describe('pickMimeType', () => {
  it('prefers webm, then mp4, and returns null when nothing is supported', () => {
    expect(pickMimeType(() => true)).toBe('audio/webm');
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(() => false)).toBeNull();
  });

  it('asks MediaRecorder by default and returns null without it', () => {
    expect(pickMimeType()).toBeNull();
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (t: string) => t === 'audio/mp4' });
    expect(pickMimeType()).toBe('audio/mp4');
    vi.unstubAllGlobals();
  });
});

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static supported = true;
  static throwOnCreate = false;
  static isTypeSupported = () => FakeMediaRecorder.supported;

  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn((_timeslice?: number) => {
    this.state = 'recording';
  });
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.onstop?.();
  });

  constructor(
    readonly stream: unknown,
    readonly options: { mimeType: string }
  ) {
    if (FakeMediaRecorder.throwOnCreate) throw new Error('NotSupportedError');
    FakeMediaRecorder.instances.push(this);
  }
}

class FakeMediaStream {
  constructor(readonly tracks: unknown[]) {}
}

function micStream() {
  const audioTrack = { kind: 'audio' };
  return {
    audioTrack,
    stream: { getAudioTracks: () => [audioTrack] } as unknown as MediaStream,
  };
}

describe('AttemptRecorder', () => {
  beforeEach(() => {
    FakeMediaRecorder.instances = [];
    FakeMediaRecorder.supported = true;
    FakeMediaRecorder.throwOnCreate = false;
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('MediaStream', FakeMediaStream);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records the audio tracks only, in the first supported container, in 5 s chunks', () => {
    const { stream, audioTrack } = micStream();
    const recorder = new AttemptRecorder();

    expect(recorder.start(stream)).toBe(true);

    const media = FakeMediaRecorder.instances[0];
    expect(media.options).toEqual({ mimeType: 'audio/webm' });
    expect((media.stream as FakeMediaStream).tracks).toEqual([audioTrack]);
    expect(media.start).toHaveBeenCalledWith(5000);
  });

  it('does not start when no container is supported', () => {
    FakeMediaRecorder.supported = false;
    expect(new AttemptRecorder().start(micStream().stream)).toBe(false);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
  });

  it('does not start when MediaRecorder cannot be created', () => {
    FakeMediaRecorder.throwOnCreate = true;
    expect(new AttemptRecorder().start(micStream().stream)).toBe(false);
  });

  it('stop() resolves with the recorded chunks, skipping empty ones', async () => {
    const recorder = new AttemptRecorder();
    recorder.start(micStream().stream);
    const media = FakeMediaRecorder.instances[0];
    media.ondataavailable?.({ data: new Blob(['abc']) });
    media.ondataavailable?.({ data: new Blob([]) });
    media.ondataavailable?.({ data: new Blob(['de']) });

    const recording = await recorder.stop();

    expect(media.stop).toHaveBeenCalledTimes(1);
    expect(recording?.contentType).toBe('audio/webm');
    expect(recording?.blob.size).toBe(5);
    expect(recording?.blob.type).toBe('audio/webm');
    await expect(recording?.blob.text()).resolves.toBe('abcde');
  });

  it('stop() resolves null when nothing was captured', async () => {
    const recorder = new AttemptRecorder();
    recorder.start(micStream().stream);
    await expect(recorder.stop()).resolves.toBeNull();
  });

  it('stop() resolves null when the recording exceeds the upload limit', async () => {
    const recorder = new AttemptRecorder();
    recorder.start(micStream().stream);
    FakeMediaRecorder.instances[0].ondataavailable?.({
      data: new Blob([new Uint8Array(AUDIO_MAX_BYTES + 1)]),
    });
    await expect(recorder.stop()).resolves.toBeNull();
  });

  it('keeps a recording of exactly the upload limit', async () => {
    const recorder = new AttemptRecorder();
    recorder.start(micStream().stream);
    FakeMediaRecorder.instances[0].ondataavailable?.({
      data: new Blob([new Uint8Array(AUDIO_MAX_BYTES)]),
    });
    const recording = await recorder.stop();
    expect(recording?.blob.size).toBe(AUDIO_MAX_BYTES);
  });

  it('stop() resolves null when never started, already inactive, or called twice', async () => {
    await expect(new AttemptRecorder().stop()).resolves.toBeNull();

    const recorder = new AttemptRecorder();
    recorder.start(micStream().stream);
    FakeMediaRecorder.instances[0].state = 'inactive';
    await expect(recorder.stop()).resolves.toBeNull();
    expect(FakeMediaRecorder.instances[0].stop).not.toHaveBeenCalled();

    const twice = new AttemptRecorder();
    twice.start(micStream().stream);
    FakeMediaRecorder.instances[1].ondataavailable?.({ data: new Blob(['x']) });
    await twice.stop();
    await expect(twice.stop()).resolves.toBeNull();
  });

  it('discard() stops the recorder without producing a recording', async () => {
    const recorder = new AttemptRecorder();
    recorder.start(micStream().stream);
    const media = FakeMediaRecorder.instances[0];
    const onstop = vi.fn();
    media.onstop = onstop;

    recorder.discard();

    expect(media.stop).toHaveBeenCalledTimes(1);
    expect(onstop).not.toHaveBeenCalled();
    await expect(recorder.stop()).resolves.toBeNull();
  });

  it('discard() leaves an inactive recorder alone', () => {
    const recorder = new AttemptRecorder();
    recorder.start(micStream().stream);
    const media = FakeMediaRecorder.instances[0];
    media.state = 'inactive';

    recorder.discard();
    new AttemptRecorder().discard();

    expect(media.stop).not.toHaveBeenCalled();
  });
});
