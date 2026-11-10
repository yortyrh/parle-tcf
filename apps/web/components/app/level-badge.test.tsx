import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LEVEL_STYLES } from '@/lib/cefr';
import { LevelBadge } from './level-badge';
import { TrendBadge } from './level-trend';

describe('LevelBadge', () => {
  it('shows the level with its colour and an accessible name', () => {
    render(<LevelBadge level="B2" />);
    const badge = screen.getByLabelText('Niveau B2');
    expect(badge).toHaveTextContent('B2');
    expect(badge.className).toContain(LEVEL_STYLES.B2.split(' ')[0]);
  });

  it('shows a dash when there is no level yet', () => {
    render(<LevelBadge level={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Niveau/)).not.toBeInTheDocument();
  });
});

describe('TrendBadge', () => {
  it.each([
    ['up', 'en progrès', 'text-success'],
    ['down', 'en baisse', 'text-destructive'],
    ['flat', 'stable', 'text-muted-foreground'],
  ] as const)('labels a %s trend in words', (trend, label, className) => {
    render(<TrendBadge trend={trend} />);
    expect(screen.getByText(label)).toHaveClass(className);
  });

  it('renders nothing without a trend', () => {
    const { container } = render(<TrendBadge trend={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
