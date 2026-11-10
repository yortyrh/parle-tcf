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

describe('mergeStreamingAssistantText (rules)', () => {
  const line = (id: string, text: string, timestamp: number, isLocal = false) => ({
    id,
    text,
    isLocal,
    timestamp,
  });

  it('merges known ids, keeps local and longer lines, appends orphans, and sorts by time', () => {
    const lines: ExamTranscriptLine[] = [
      line('u1', 'Bonjour', 5, true),
      line('a1', 'Sal', 2),
      line('a2', 'Une longue réponse', 9),
      line('a3', 'Sans flux', 7),
    ];
    const merged = mergeStreamingAssistantText(lines, {
      u1: 'Texte local bien plus long',
      a1: 'Salut à vous',
      a2: 'Courte',
      o1: 'Orphelin',
      o2: '',
      o3: 'Deuxième orphelin',
    });
    expect(merged).toEqual([
      line('a1', 'Salut à vous', 2),
      line('u1', 'Bonjour', 5, true),
      line('a3', 'Sans flux', 7),
      line('a2', 'Une longue réponse', 9),
      line('o1', 'Orphelin', 10),
      line('o3', 'Deuxième orphelin', 11),
    ]);
  });

  it('keeps the history text when the stream is only as long', () => {
    const lines: ExamTranscriptLine[] = [line('a1', 'abc', 0)];
    expect(mergeStreamingAssistantText(lines, { a1: 'xyz' })).toEqual([line('a1', 'abc', 0)]);
  });

  it('ignores an empty stream entry for a known line', () => {
    const lines: ExamTranscriptLine[] = [line('a1', 'abc', 0)];
    expect(mergeStreamingAssistantText(lines, { a1: '' })).toEqual([line('a1', 'abc', 0)]);
  });

  it('numbers orphans from 0 when there is no history', () => {
    expect(mergeStreamingAssistantText([], { x: 'un', y: 'deux' })).toEqual([
      line('x', 'un', 0),
      line('y', 'deux', 1),
    ]);
  });

  it('returns history unchanged when nothing streams', () => {
    const lines: ExamTranscriptLine[] = [line('a2', 'deux', 3), line('a1', 'un', 1)];
    expect(mergeStreamingAssistantText(lines, {})).toEqual([
      line('a1', 'un', 1),
      line('a2', 'deux', 3),
    ]);
  });
});

describe('pruneStreamBuffer (rules)', () => {
  it('drops an entry the history covers exactly', () => {
    const buf: Record<string, string> = { m1: 'done' };
    pruneStreamBuffer([{ id: 'm1', text: 'done', isLocal: false, timestamp: 0 }], buf);
    expect(buf).toEqual({});
  });

  it('keeps an entry the history has not caught up with', () => {
    const buf: Record<string, string> = { m1: 'longer stream' };
    pruneStreamBuffer([{ id: 'm1', text: 'short', isLocal: false, timestamp: 0 }], buf);
    expect(buf).toEqual({ m1: 'longer stream' });
  });

  it('keeps entries with no matching history line, or only a local one', () => {
    const buf: Record<string, string> = { m1: 'a', m2: 'b' };
    pruneStreamBuffer(
      [
        { id: 'other', text: 'a much longer line', isLocal: false, timestamp: 0 },
        { id: 'm2', text: 'a much longer line', isLocal: true, timestamp: 1 },
      ],
      buf
    );
    expect(buf).toEqual({ m1: 'a', m2: 'b' });
  });
});
