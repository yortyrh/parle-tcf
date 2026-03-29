import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildReportDataMessages, splitUtf8ByMaxBytes } from './reportDataPayload.js';

describe('splitUtf8ByMaxBytes', () => {
  it('returns one segment when under limit', () => {
    assert.deepStrictEqual(splitUtf8ByMaxBytes('hello', 100), ['hello']);
  });

  it('splits on UTF-8 byte boundaries', () => {
    const s = 'é'.repeat(10); // 2 bytes each in UTF-8
    const parts = splitUtf8ByMaxBytes(s, 4);
    assert.strictEqual(parts.length, 5);
    assert.strictEqual(parts.join(''), s);
  });

  it('does not split emoji code points', () => {
    const s = '🙂'.repeat(3);
    const parts = splitUtf8ByMaxBytes(s, 4);
    assert.ok(parts.every((p) => p.length > 0));
    assert.strictEqual(parts.join(''), s);
  });
});

describe('buildReportDataMessages', () => {
  it('uses a single report message for short content', () => {
    const msgs = buildReportDataMessages('hello', { newId: () => 'fixed-id' });
    assert.strictEqual(msgs.length, 1);
    assert.deepStrictEqual(msgs[0], { type: 'report', report: 'hello' });
  });

  it('uses multipart when payload would exceed LiveKit limit', () => {
    const chunk = 'a'.repeat(20_000);
    const msgs = buildReportDataMessages(chunk, { newId: () => 'id-1' });
    assert.ok(msgs.length >= 3);
    const header = msgs[0] as { type: string; id: string; total: number };
    assert.strictEqual(header.type, 'report_multipart');
    assert.strictEqual(header.id, 'id-1');
    assert.strictEqual(header.total, msgs.length - 1);
    let rebuilt = '';
    for (let i = 1; i < msgs.length; i++) {
      const m = msgs[i] as { type: string; id: string; index: number; text: string };
      assert.strictEqual(m.type, 'report_part');
      assert.strictEqual(m.id, 'id-1');
      assert.strictEqual(m.index, i - 1);
      rebuilt += m.text;
    }
    assert.strictEqual(rebuilt, chunk);
  });
});
