import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './theme-provider';
import { ThemeToggle } from './theme-toggle';

const theme = vi.hoisted(() => ({ current: 'light', setTheme: vi.fn() }));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: theme.current, setTheme: theme.setTheme }),
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));

beforeEach(() => {
  theme.current = 'light';
  theme.setTheme.mockReset();
});

function iconOf(name: string) {
  return screen.getByRole('button', { name }).querySelector('svg');
}

describe('ThemeToggle', () => {
  it.each([
    ['Thème sombre', 'dark'],
    ['Thème clair', 'light'],
    ['Thème du système', 'system'],
  ])('"%s" switches to the %s theme', async (name, value) => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name }));
    expect(theme.setTheme).toHaveBeenCalledWith(value);
  });

  it.each([
    ['dark', 'Thème sombre'],
    ['light', 'Thème clair'],
    ['system', 'Thème du système'],
  ])('highlights only the active %s theme', (active, activeName) => {
    theme.current = active;
    render(<ThemeToggle className="w-fit" />);
    for (const name of ['Thème sombre', 'Thème clair', 'Thème du système']) {
      expect(iconOf(name)?.classList.contains('opacity-25')).toBe(name !== activeName);
    }
  });

  it('renders inside the theme provider', () => {
    render(
      <ThemeProvider attribute="class">
        <ThemeToggle />
      </ThemeProvider>
    );
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
