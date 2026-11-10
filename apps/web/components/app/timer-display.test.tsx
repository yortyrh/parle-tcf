import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimerDisplay } from './timer-display';

function digits() {
  return screen.getByText(/^\d{2}:\d{2}$/);
}

describe('TimerDisplay', () => {
  it('shows minutes and seconds with a label in full size', () => {
    render(<TimerDisplay remainingSeconds={125} />);
    expect(screen.getByRole('timer', { name: 'Temps restant' })).toHaveTextContent(
      'Temps restant02:05'
    );
    expect(digits()).toHaveClass('text-2xl');
  });

  it('drops the label when compact', () => {
    render(<TimerDisplay remainingSeconds={125} compact />);
    expect(screen.queryByText('Temps restant')).not.toBeInTheDocument();
    expect(digits()).toHaveClass('text-base');
  });

  it('turns red in the last 30 seconds', () => {
    const { rerender } = render(<TimerDisplay remainingSeconds={31} />);
    expect(digits()).toHaveClass('text-primary');
    expect(digits()).not.toHaveClass('text-destructive');

    rerender(<TimerDisplay remainingSeconds={30} />);
    expect(digits()).toHaveClass('text-destructive');
    expect(digits()).toHaveTextContent('00:30');
  });
});
