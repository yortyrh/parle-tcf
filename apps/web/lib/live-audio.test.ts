import { describe, expect, it } from 'vitest';
import { TurnTranscript, floatToPcm16Base64, pcm16Base64ToFloat } from './live-audio';

describe('pcm16 conversion', () => {
  it('round-trips samples within quantisation error and clamps overflow', () => {
    const input = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
    const out = pcm16Base64ToFloat(floatToPcm16Base64(input));
    expect(out).toHaveLength(6);
    [0, 0.5, -0.5].forEach((v, i) => expect(out[i]).toBeCloseTo(v, 3));
    expect(out[3]).toBeCloseTo(1, 2);
    expect(out[4]).toBeCloseTo(-1, 3);
    expect(out[5]).toBeCloseTo(1, 2); // 2 was clamped
  });
});

describe('TurnTranscript', () => {
  it('accumulates chunks per speaker and splits on speaker change or turn end', () => {
    const t = new TurnTranscript(() => 1);
    t.addOutput('Bonjour');
    t.addOutput(', comment allez-vous ?');
    t.addInput(' Très bien');
    t.addInput(', merci.');
    t.endTurn();
    t.addInput('Et vous ?');
    expect(t.snapshot().map((l) => [l.isLocal, l.text])).toEqual([
      [false, 'Bonjour, comment allez-vous ?'],
      [true, 'Très bien, merci.'],
      [true, 'Et vous ?'],
    ]);
  });

  it('ignores empty chunks', () => {
    const t = new TurnTranscript();
    t.addInput('');
    expect(t.snapshot()).toEqual([]);
  });
});
