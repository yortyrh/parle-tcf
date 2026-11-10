import { describe, expect, it } from 'vitest';
import type { RealtimeItem } from '@openai/agents/realtime';
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

describe('transcriptLinesFromHistory mapping', () => {
  const history = [
    {
      type: 'message',
      itemId: 's',
      role: 'system',
      content: [{ type: 'input_text', text: 'Règles' }],
    },
    { type: 'function_call', itemId: 'f', name: 'finSession' },
    {
      type: 'message',
      itemId: 'u1',
      role: 'user',
      status: 'completed',
      content: [
        { type: 'input_text', text: 'Bonjour' },
        { type: 'input_audio', transcript: 'je suis prête' },
        { type: 'input_audio', transcript: null },
        { type: 'input_text', text: '' },
      ],
    },
    {
      type: 'message',
      itemId: 'a1',
      role: 'assistant',
      status: 'completed',
      content: [
        { type: 'output_audio', transcript: 'Très bien.' },
        { type: 'output_text', text: 'Commençons.' },
        { type: 'output_audio', transcript: null },
      ],
    },
    { type: 'message', itemId: 'u2', role: 'user', status: 'completed', content: [] },
  ] as unknown as RealtimeItem[];

  it('keeps user and assistant messages, joining their text and audio transcripts', () => {
    expect(transcriptLinesFromHistory(history)).toEqual([
      { id: 'u1', text: 'Bonjour je suis prête', isLocal: true, timestamp: 0 },
      { id: 'a1', text: 'Très bien. Commençons.', isLocal: false, timestamp: 1 },
    ]);
  });

  it('numbers lines without an item id by position', () => {
    const lines = transcriptLinesFromHistory([
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Salut' }] },
    ] as unknown as RealtimeItem[]);
    expect(lines[0].id).toBe('m-0');
  });

  it('never keeps an empty in-progress user message', () => {
    expect(
      transcriptLinesFromHistory([
        { type: 'message', itemId: 'u', role: 'user', status: 'in_progress', content: [] },
      ] as unknown as RealtimeItem[])
    ).toEqual([]);
  });
});

describe('transcriptLinesFromHistory content rules', () => {
  const message = (role: string, content: unknown[], itemId = role) =>
    ({ type: 'message', itemId, role, status: 'completed', content }) as unknown as RealtimeItem;

  it('reads only input parts for the user, each by its own field', () => {
    const lines = transcriptLinesFromHistory([
      message('user', [
        { type: 'output_text', text: 'sortie' },
        { type: 'output_audio', transcript: 'sortie audio' },
        { type: 'input_text', text: 'texte', transcript: 'pas ici' },
        { type: 'input_audio', transcript: 'audio', text: 'pas ici non plus' },
      ]),
    ]);
    expect(lines.map((l) => l.text)).toEqual(['texte audio']);
  });

  it('reads only output parts for the assistant, each by its own field', () => {
    const lines = transcriptLinesFromHistory([
      message('assistant', [
        { type: 'input_text', text: 'entrée' },
        { type: 'input_audio', transcript: 'entrée audio' },
        { type: 'output_text', text: 'texte', transcript: 'pas ici' },
        { type: 'output_audio', transcript: 'audio', text: 'pas ici non plus' },
      ]),
    ]);
    expect(lines.map((l) => l.text)).toEqual(['texte audio']);
  });

  it('trims the joined text and drops whitespace-only messages', () => {
    const lines = transcriptLinesFromHistory([
      message('user', [{ type: 'input_text', text: '  Bonjour  ' }], 'u1'),
      message('assistant', [{ type: 'output_audio', transcript: ' Salut ' }], 'a1'),
      message('user', [{ type: 'input_text', text: '   ' }], 'u2'),
      message('assistant', [{ type: 'output_text', text: ' \n ' }], 'a2'),
    ]);
    expect(lines).toEqual([
      { id: 'u1', text: 'Bonjour', isLocal: true, timestamp: 0 },
      { id: 'a1', text: 'Salut', isLocal: false, timestamp: 1 },
    ]);
  });

  it('never shows a system message, whatever its parts', () => {
    expect(
      transcriptLinesFromHistory([
        message('system', [
          { type: 'output_text', text: 'Consignes' },
          { type: 'output_audio', transcript: 'Consignes audio' },
        ]),
      ])
    ).toEqual([]);
  });
});
