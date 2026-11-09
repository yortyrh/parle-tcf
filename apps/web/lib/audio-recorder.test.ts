import { describe, expect, it } from 'vitest';
import { pickMimeType } from './audio-recorder';

describe('pickMimeType', () => {
  it('prefers webm, then mp4, and returns null when nothing is supported', () => {
    expect(pickMimeType(() => true)).toBe('audio/webm');
    expect(pickMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType(() => false)).toBeNull();
  });
});
