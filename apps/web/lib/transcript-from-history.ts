import type { RealtimeItem } from '@openai/agents/realtime';

export interface ExamTranscriptLine {
  id: string;
  text: string;
  isLocal: boolean;
  timestamp: number;
}

type ContentPart = { type: string; text?: string | null; transcript?: string | null };

function textFromUserContent(content: ContentPart[]): string {
  const parts: string[] = [];
  for (const c of content) {
    if (c.type === 'input_text' && c.text) parts.push(c.text);
    if (c.type === 'input_audio' && c.transcript) parts.push(c.transcript);
  }
  return parts.join(' ').trim();
}

function textFromAssistantContent(content: ContentPart[]): string {
  const parts: string[] = [];
  for (const c of content) {
    if (c.type === 'output_text' && c.text) parts.push(c.text);
    if (c.type === 'output_audio' && c.transcript) parts.push(c.transcript);
  }
  return parts.join(' ').trim();
}

/**
 * Maps Realtime session history items to flat transcript lines for the UI.
 */
export function transcriptLinesFromHistory(history: RealtimeItem[]): ExamTranscriptLine[] {
  const lines: ExamTranscriptLine[] = [];
  let seq = 0;
  for (const item of history) {
    if (item.type !== 'message') continue;
    const msg = item as {
      itemId: string;
      role: 'user' | 'assistant' | 'system';
      content: ContentPart[];
    };
    if (msg.role === 'system') continue;
    const text =
      msg.role === 'user'
        ? textFromUserContent(msg.content)
        : textFromAssistantContent(msg.content);
    if (!text) continue;
    lines.push({
      id: msg.itemId ?? `m-${seq}`,
      text,
      isLocal: msg.role === 'user',
      timestamp: seq,
    });
    seq += 1;
  }
  return lines;
}
