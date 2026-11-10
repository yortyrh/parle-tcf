import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SESSION_PHASE_LABELS, type SessionPhase } from '@/lib/session-phase';
import { SessionStatus } from './session-status';

const PHASES = Object.keys(SESSION_PHASE_LABELS) as SessionPhase[];
const LIVE: SessionPhase[] = ['examiner-speaking', 'candidate-speaking', 'listening'];

describe('SessionStatus', () => {
  it.each(PHASES)('announces the %s phase politely in French', (phase) => {
    render(<SessionStatus phase={phase} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(SESSION_PHASE_LABELS[phase]);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it.each(PHASES)('pulses the dot only while someone has the floor (%s)', (phase) => {
    render(<SessionStatus phase={phase} />);
    const dot = screen.getByRole('status').querySelector('[aria-hidden]');
    expect(dot?.classList.contains('animate-pulse')).toBe(LIVE.includes(phase));
  });

  it('uses a destructive tone when the mic is muted', () => {
    render(<SessionStatus phase="muted" className="extra" />);
    expect(screen.getByRole('status')).toHaveClass('text-destructive', 'extra');
  });
});
