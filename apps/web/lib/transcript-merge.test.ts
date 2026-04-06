import { describe, expect, it } from 'vitest';
import type { ExamTranscriptLine } from './transcript-from-history';
import { mergeStreamingAssistantText, pruneStreamBuffer } from './transcript-merge';

describe('mergeStreamingAssistantText', () => {
  it('prefers longer stream buffer over history line', () => {
    const lines: ExamTranscriptLine[] = [{ id: 'a1', text: 'Hi', isLocal: false, timestamp: 0 }];
    const merged = mergeStreamingAssistantText(lines, { a1: 'Hello world' });
    expect(merged.find((l) => l.id === 'a1')?.text).toBe('Hello world');
  });

  it('appends orphan stream ids as assistant lines', () => {
    const lines: ExamTranscriptLine[] = [];
    const merged = mergeStreamingAssistantText(lines, { x: 'streaming' });
    expect(merged.length).toBe(1);
    expect(merged[0].text).toBe('streaming');
    expect(merged[0].isLocal).toBe(false);
  });
});

describe('pruneStreamBuffer', () => {
  it('drops buffer when history fully covers', () => {
    const lines: ExamTranscriptLine[] = [{ id: 'm1', text: 'done', isLocal: false, timestamp: 0 }];
    const buf: Record<string, string> = { m1: 'do' };
    pruneStreamBuffer(lines, buf);
    expect(buf.m1).toBeUndefined();
  });
});
