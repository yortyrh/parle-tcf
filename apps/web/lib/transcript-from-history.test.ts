import { describe, expect, it } from 'vitest';
import { transcriptLinesFromHistory } from './transcript-from-history';

describe('transcriptLinesFromHistory', () => {
  it('includes in_progress assistant with empty text', () => {
    const history = [
      {
        type: 'message' as const,
        itemId: 'i1',
        role: 'assistant' as const,
        status: 'in_progress' as const,
        content: [{ type: 'output_text' as const, text: '' }],
      },
    ];
    const lines = transcriptLinesFromHistory(history);
    expect(lines.length).toBe(1);
    expect(lines[0].text).toBe('');
    expect(lines[0].isLocal).toBe(false);
  });

  it('skips empty completed assistant', () => {
    const history = [
      {
        type: 'message' as const,
        itemId: 'i2',
        role: 'assistant' as const,
        status: 'completed' as const,
        content: [{ type: 'output_text' as const, text: '' }],
      },
    ];
    const lines = transcriptLinesFromHistory(history);
    expect(lines.length).toBe(0);
  });
});
