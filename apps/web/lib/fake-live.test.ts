import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_CLIENT_SECRET_PREFIX, FAKE_SCRIPT, FakeLiveSession, isFakeVoice } from './fake-live';
import type { GeminiLiveOptions } from './gemini-live';

const READY = 'Le candidat est prêt. Commencez la tâche.';
const STEP = 100;

function makeOpts() {
  const events: string[] = [];
  const opts = {
    token: 'fake-client-secret-1',
    model: 'fake',
    voice: 'fake',
    instructions: '',
    stream: {} as MediaStream,
    onLines: vi.fn((lines: unknown[]) => events.push(`lines:${lines.length}`)),
    onAgentSpeaking: vi.fn((speaking: boolean) => events.push(`speaking:${speaking}`)),
    onUsage: vi.fn(() => events.push('usage')),
    onTool: vi.fn((name: string) => events.push(`tool:${name}`)),
    onError: vi.fn(),
    onClose: vi.fn(() => events.push('close')),
  } satisfies GeminiLiveOptions;
  return { opts, events };
}

describe('isFakeVoice', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true with the flag set to "true" and a fake secret', () => {
    vi.stubEnv('NEXT_PUBLIC_FAKE_VOICE', 'true');
    expect(isFakeVoice(`${FAKE_CLIENT_SECRET_PREFIX}-abc`)).toBe(true);
    expect(isFakeVoice(FAKE_CLIENT_SECRET_PREFIX)).toBe(true);
  });

  it('is false without the flag, even with a fake secret', () => {
    vi.stubEnv('NEXT_PUBLIC_FAKE_VOICE', '');
    expect(isFakeVoice(`${FAKE_CLIENT_SECRET_PREFIX}-abc`)).toBe(false);
  });

  it('is false when the flag is anything other than "true"', () => {
    for (const value of ['1', 'TRUE', 'yes', 'false', ' true']) {
      vi.stubEnv('NEXT_PUBLIC_FAKE_VOICE', value);
      expect(isFakeVoice(`${FAKE_CLIENT_SECRET_PREFIX}-abc`)).toBe(false);
    }
  });

  it('is false with the flag but a real secret', () => {
    vi.stubEnv('NEXT_PUBLIC_FAKE_VOICE', 'true');
    expect(isFakeVoice('ek_real_openai_secret')).toBe(false);
    expect(isFakeVoice('')).toBe(false);
    expect(isFakeVoice(`x-${FAKE_CLIENT_SECRET_PREFIX}`)).toBe(false);
  });

  it('uses the prefix the API mints', () => {
    expect(FAKE_CLIENT_SECRET_PREFIX).toBe('fake-client-secret');
  });
});

describe('FAKE_SCRIPT', () => {
  it('is examiner, candidate, examiner', () => {
    expect(FAKE_SCRIPT.map((l) => l.isLocal)).toEqual([false, true, false]);
    for (const line of FAKE_SCRIPT) expect(line.text.length).toBeGreaterThan(0);
  });
});

describe('FakeLiveSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects without doing anything', async () => {
    const { opts, events } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    await expect(session.connect()).resolves.toBeUndefined();
    await vi.runAllTimersAsync();
    expect(events).toEqual([]);
  });

  it('plays nothing before the candidate-ready text', () => {
    const { opts, events } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText('Bonjour');
    session.sendText('le candidat est prêt'); // case matters
    session.sendText(' Le candidat est prêt'); // must be a prefix
    vi.runAllTimers();
    expect(events).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts on a text that begins with the ready prefix', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText('Le candidat est prêt');
    vi.runAllTimers();
    expect(opts.onTool).toHaveBeenCalledWith('finSession');
  });

  it('plays the script line by line, accumulating the lines in order', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText(READY);

    vi.advanceTimersByTime(STEP - 1);
    expect(opts.onLines).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(opts.onLines).toHaveBeenCalledTimes(1);
    expect(opts.onLines).toHaveBeenLastCalledWith([
      {
        id: 'fake-0',
        text: FAKE_SCRIPT[0].text,
        isLocal: false,
        timestamp: new Date('2026-01-01T00:00:00Z').getTime() + STEP,
      },
    ]);

    vi.advanceTimersByTime(STEP);
    expect(opts.onLines).toHaveBeenCalledTimes(2);
    expect(opts.onLines.mock.lastCall?.[0]).toMatchObject([
      { id: 'fake-0', text: FAKE_SCRIPT[0].text, isLocal: false },
      { id: 'fake-1', text: FAKE_SCRIPT[1].text, isLocal: true },
    ]);

    vi.advanceTimersByTime(STEP);
    expect(opts.onLines).toHaveBeenCalledTimes(3);
    expect(opts.onLines.mock.lastCall?.[0]).toMatchObject([
      { id: 'fake-0', isLocal: false },
      { id: 'fake-1', isLocal: true },
      { id: 'fake-2', text: FAKE_SCRIPT[2].text, isLocal: false },
    ]);
    expect(opts.onTool).not.toHaveBeenCalled();
  });

  it('hands out a fresh array on each update', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText(READY);
    vi.runAllTimers();
    const [first, second] = opts.onLines.mock.calls.map((c) => c[0]);
    expect(first).not.toBe(second);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
  });

  it('toggles onAgentSpeaking: true for the examiner, false for the candidate', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText(READY);
    vi.advanceTimersByTime(STEP * FAKE_SCRIPT.length);
    expect(opts.onAgentSpeaking.mock.calls.map((c) => c[0])).toEqual([true, false, true]);
  });

  it('ends with speaking off, the usage, then finSession', () => {
    const { opts, events } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText(READY);

    vi.advanceTimersByTime(STEP * (FAKE_SCRIPT.length + 1) - 1);
    expect(opts.onTool).not.toHaveBeenCalled();
    expect(opts.onUsage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(events).toEqual([
      'speaking:true',
      'lines:1',
      'speaking:false',
      'lines:2',
      'speaking:true',
      'lines:3',
      'speaking:false',
      'usage',
      'tool:finSession',
    ]);
    expect(opts.onUsage).toHaveBeenCalledWith({ inputTokens: 100, outputTokens: 50 });
    expect(opts.onTool).toHaveBeenCalledTimes(1);
    expect(opts.onClose).not.toHaveBeenCalled();
    expect(opts.onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses a 400 ms step by default', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts);
    session.sendText(READY);
    vi.advanceTimersByTime(399);
    expect(opts.onLines).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(opts.onLines).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400 * FAKE_SCRIPT.length - 1);
    expect(opts.onTool).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(opts.onTool).toHaveBeenCalledWith('finSession');
  });

  it('ignores a second ready text: the script plays once', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText(READY);
    vi.advanceTimersByTime(STEP);
    session.sendText(READY);
    vi.runAllTimers();
    expect(opts.onLines).toHaveBeenCalledTimes(FAKE_SCRIPT.length);
    expect(opts.onUsage).toHaveBeenCalledTimes(1);
    expect(opts.onTool).toHaveBeenCalledTimes(1);
  });

  it('ignores other texts while the script plays', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText(READY);
    session.sendText('Autre chose');
    vi.runAllTimers();
    expect(opts.onLines).toHaveBeenCalledTimes(FAKE_SCRIPT.length);
    expect(opts.onLines.mock.lastCall?.[0]).toHaveLength(FAKE_SCRIPT.length);
  });

  it('close() stops the pending timers, turns speaking off and reports the close', () => {
    const { opts, events } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText(READY);
    vi.advanceTimersByTime(STEP);
    expect(opts.onLines).toHaveBeenCalledTimes(1);

    session.close();
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();

    expect(opts.onLines).toHaveBeenCalledTimes(1);
    expect(opts.onUsage).not.toHaveBeenCalled();
    expect(opts.onTool).not.toHaveBeenCalled();
    expect(events).toEqual(['speaking:true', 'lines:1', 'speaking:false', 'close']);
  });

  it('close() before the script starts reports the close and stays silent', () => {
    const { opts, events } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.close();
    expect(events).toEqual(['speaking:false', 'close']);
  });

  it('close() is idempotent', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.close();
    session.close();
    expect(opts.onClose).toHaveBeenCalledTimes(1);
    expect(opts.onAgentSpeaking).toHaveBeenCalledTimes(1);
  });

  it('ignores the ready text after close()', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.close();
    session.sendText(READY);
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(opts.onLines).not.toHaveBeenCalled();
    expect(opts.onTool).not.toHaveBeenCalled();
  });

  it('fired callbacks check the closed flag even if a timer still runs', () => {
    const { opts } = makeOpts();
    const session = new FakeLiveSession(opts, STEP);
    session.sendText(READY);
    // A timer clearTimeout misses (e.g. already queued) must still be a no-op.
    const clear = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => undefined);
    session.close();
    clear.mockRestore();
    vi.runAllTimers();
    expect(opts.onLines).not.toHaveBeenCalled();
    expect(opts.onUsage).not.toHaveBeenCalled();
    expect(opts.onTool).not.toHaveBeenCalled();
    expect(opts.onAgentSpeaking).toHaveBeenCalledTimes(1);
  });
});
