import { describe, expect, it } from 'vitest';
import {
  AUDIO_MAX_BYTES,
  AUDIO_MIME_TYPES,
  audioConfirmInputSchema,
  audioDownloadOutputSchema,
  audioStatusSchema,
  audioUploadInputSchema,
  audioUploadOutputSchema,
  setAudioConsentInputSchema,
} from './audio';

const ATTEMPT = '22222222-2222-4222-8222-222222222222';

describe('audio constants', () => {
  it('caps recordings at 25 MiB', () => {
    expect(AUDIO_MAX_BYTES).toBe(25 * 1024 * 1024);
  });

  it('allows webm, mp4 and ogg audio only', () => {
    expect([...AUDIO_MIME_TYPES]).toEqual(['audio/webm', 'audio/mp4', 'audio/ogg']);
  });
});

describe('audioUploadInputSchema', () => {
  it.each(AUDIO_MIME_TYPES)('accepts %s', (contentType) => {
    expect(audioUploadInputSchema.parse({ attemptId: ATTEMPT, contentType })).toEqual({
      attemptId: ATTEMPT,
      contentType,
    });
  });

  it.each(['audio/wav', 'video/webm', 'audio/webm;codecs=opus', ''])(
    'rejects the content type %j',
    (contentType) => {
      expect(audioUploadInputSchema.safeParse({ attemptId: ATTEMPT, contentType }).success).toBe(
        false
      );
    }
  );

  it('requires a uuid attempt id', () => {
    expect(
      audioUploadInputSchema.safeParse({ attemptId: 'abc', contentType: 'audio/webm' }).success
    ).toBe(false);
    expect(audioConfirmInputSchema.parse({ attemptId: ATTEMPT })).toEqual({ attemptId: ATTEMPT });
    expect(audioConfirmInputSchema.safeParse({ attemptId: 'abc' }).success).toBe(false);
  });
});

describe('audioUploadOutputSchema', () => {
  const output = {
    url: 'https://bucket.test/upload',
    fields: { key: 'audio/u/a', 'Content-Type': 'audio/webm' },
    contentType: 'audio/webm',
    maxBytes: AUDIO_MAX_BYTES,
  };

  it('accepts a presigned POST', () => {
    expect(audioUploadOutputSchema.parse(output)).toEqual(output);
  });

  it('requires an absolute url, string fields and a positive integer size', () => {
    expect(audioUploadOutputSchema.safeParse({ ...output, url: '/upload' }).success).toBe(false);
    expect(audioUploadOutputSchema.safeParse({ ...output, fields: { key: 1 } }).success).toBe(
      false
    );
    expect(audioUploadOutputSchema.safeParse({ ...output, maxBytes: 0 }).success).toBe(false);
    expect(audioUploadOutputSchema.safeParse({ ...output, maxBytes: 1 }).success).toBe(true);
    expect(audioUploadOutputSchema.safeParse({ ...output, maxBytes: 1.5 }).success).toBe(false);
  });
});

describe('audio status, consent and download', () => {
  it('validates booleans', () => {
    expect(audioStatusSchema.parse({ available: true, consent: false })).toEqual({
      available: true,
      consent: false,
    });
    expect(audioStatusSchema.safeParse({ available: 'yes', consent: false }).success).toBe(false);
    expect(setAudioConsentInputSchema.parse({ consent: true })).toEqual({ consent: true });
    expect(setAudioConsentInputSchema.safeParse({}).success).toBe(false);
  });

  it('returns a url or null', () => {
    expect(audioDownloadOutputSchema.parse({ url: null })).toEqual({ url: null });
    expect(audioDownloadOutputSchema.parse({ url: 'https://bucket.test/a' })).toEqual({
      url: 'https://bucket.test/a',
    });
    expect(audioDownloadOutputSchema.safeParse({ url: 'nope' }).success).toBe(false);
  });
});
