import type { ExamTranscriptLine } from '@/lib/transcript-from-history';

/**
 * Merges server-streamed assistant text (by message item id) into transcript lines.
 * Adds placeholder rows for item ids seen in the stream before they appear in history.
 */
export function mergeStreamingAssistantText(
  lines: ExamTranscriptLine[],
  streamByItemId: Record<string, string>
): ExamTranscriptLine[] {
  const knownIds = new Set(lines.map((l) => l.id));
  let maxTs = lines.reduce((m, l) => Math.max(m, l.timestamp), -1);

  const merged = lines.map((l) => {
    if (l.isLocal) return l;
    const extra = streamByItemId[l.id];
    if (extra == null || extra.length === 0) return l;
    return extra.length > l.text.length ? { ...l, text: extra } : l;
  });

  const orphans: ExamTranscriptLine[] = [];
  for (const [id, text] of Object.entries(streamByItemId)) {
    if (knownIds.has(id) || text.length === 0) continue;
    maxTs += 1;
    orphans.push({
      id,
      text,
      isLocal: false,
      timestamp: maxTs,
    });
  }

  return [...merged, ...orphans].sort((a, b) => a.timestamp - b.timestamp);
}

/** Drop stream buffer entries that history already fully covers. */
export function pruneStreamBuffer(lines: ExamTranscriptLine[], buf: Record<string, string>): void {
  for (const id of Object.keys(buf)) {
    const line = lines.find((l) => l.id === id && !l.isLocal);
    if (line != null && line.text.length >= (buf[id]?.length ?? 0)) {
      delete buf[id];
    }
  }
}
