import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState, ErrorState, ListSkeleton } from './states';

describe('EmptyState', () => {
  it('shows the title, the description and the action', () => {
    render(
      <EmptyState
        title="Aucun sujet trouvé"
        description="Essayez un autre mot-clé."
        action={<button type="button">Créer</button>}
      />
    );
    expect(screen.getByText('Aucun sujet trouvé')).toBeInTheDocument();
    expect(screen.getByText('Essayez un autre mot-clé.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer' })).toBeInTheDocument();
  });

  it('shows only the title when nothing else is given', () => {
    const { container } = render(<EmptyState title="Rien" />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('announces the message as an alert and retries on click', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Impossible de charger." onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger.');
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has no retry button without a handler', () => {
    render(<ErrorState message="Erreur" />);
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
  });
});

describe('ListSkeleton', () => {
  it('renders 4 placeholder rows by default, announced as loading', () => {
    render(<ListSkeleton />);
    const status = screen.getByRole('status', { name: 'Chargement' });
    expect(status.children).toHaveLength(4);
  });

  it('renders the requested number of rows', () => {
    render(<ListSkeleton rows={2} />);
    expect(screen.getByRole('status').children).toHaveLength(2);
  });
});
