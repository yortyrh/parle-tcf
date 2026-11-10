import { describe, expect, it } from 'vitest';
import { SESSION_PHASE_LABELS, type SessionPhase, sessionPhase } from './session-phase';

type State = Parameters<typeof sessionPhase>[0];

/** A connected session where no rule but the fallback applies. */
const NEUTRAL: State = {
  preparing: false,
  isConnecting: false,
  isConnected: true,
  sessionEnded: false,
  agentSpeaking: false,
  userSpeaking: false,
  micEnabled: true,
};

/** Rules in priority order, each with the patch that makes it match. */
const RULES: [SessionPhase, Partial<State>][] = [
  ['preparing', { preparing: true }],
  ['connecting', { isConnecting: true }],
  ['idle', { isConnected: false }],
  ['ended', { sessionEnded: true }],
  ['examiner-speaking', { agentSpeaking: true }],
  ['muted', { micEnabled: false }],
  ['candidate-speaking', { userSpeaking: true }],
];

const ALL_PHASES: SessionPhase[] = [
  'preparing',
  'connecting',
  'idle',
  'ended',
  'examiner-speaking',
  'muted',
  'candidate-speaking',
  'listening',
];

describe('sessionPhase', () => {
  it('is listening when no rule matches', () => {
    expect(sessionPhase(NEUTRAL)).toBe('listening');
  });

  it.each(RULES)('returns %s when only its rule matches', (phase, patch) => {
    expect(sessionPhase({ ...NEUTRAL, ...patch })).toBe(phase);
  });

  const pairs = RULES.flatMap(([phase, patch], i) =>
    RULES.slice(i + 1).map(([later, laterPatch]) => [phase, later, patch, laterPatch] as const)
  );

  it.each(pairs)('%s beats %s', (phase, _later, patch, laterPatch) => {
    expect(sessionPhase({ ...NEUTRAL, ...laterPatch, ...patch })).toBe(phase);
  });

  it.each(RULES.map(([phase], i) => [phase, i] as const))(
    '%s beats all later rules at once',
    (phase, i) => {
      const state = RULES.slice(i).reduce<State>((s, [, patch]) => ({ ...s, ...patch }), NEUTRAL);
      expect(sessionPhase(state)).toBe(phase);
    }
  );

  it('is preparing even when everything else matches', () => {
    expect(
      sessionPhase({
        preparing: true,
        isConnecting: true,
        isConnected: false,
        sessionEnded: true,
        agentSpeaking: true,
        userSpeaking: true,
        micEnabled: false,
      })
    ).toBe('preparing');
  });

  it('is ended while connected even with the examiner speaking', () => {
    expect(sessionPhase({ ...NEUTRAL, sessionEnded: true, agentSpeaking: true })).toBe('ended');
  });

  it('is candidate-speaking with the mic on and listening once the candidate stops', () => {
    expect(sessionPhase({ ...NEUTRAL, userSpeaking: true, micEnabled: true })).toBe(
      'candidate-speaking'
    );
    expect(sessionPhase({ ...NEUTRAL, userSpeaking: false, micEnabled: true })).toBe('listening');
  });
});

describe('SESSION_PHASE_LABELS', () => {
  it('has a label for every phase and nothing else', () => {
    expect(Object.keys(SESSION_PHASE_LABELS).sort()).toEqual([...ALL_PHASES].sort());
  });

  it('has non-empty, distinct labels', () => {
    const labels = Object.values(SESSION_PHASE_LABELS);
    for (const label of labels) {
      expect(typeof label).toBe('string');
      expect(label.trim()).not.toBe('');
    }
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('uses French labels, not the identifiers', () => {
    for (const phase of ALL_PHASES) {
      expect(SESSION_PHASE_LABELS[phase]).not.toBe(phase);
    }
  });
});
