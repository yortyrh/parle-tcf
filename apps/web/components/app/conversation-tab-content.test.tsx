import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ExamTranscriptLine } from '@/lib/transcript-from-history';
import { ConversationTabContent } from './conversation-tab-content';

const LINES: ExamTranscriptLine[] = [
  { id: 'c', text: 'Je travaille à Lyon.', isLocal: true, timestamp: 3 },
  { id: 'a', text: 'Bonjour, **présentez-vous**.', isLocal: false, timestamp: 1 },
  { id: 'b', text: '', isLocal: false, timestamp: 2 },
];

beforeEach(() => {
  // The virtualizer measures the scroll container: give jsdom a real-looking size.
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 600,
    top: 0,
    left: 0,
    right: 400,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ConversationTabContent', () => {
  it('shows the lines in time order with their speaker', async () => {
    render(<ConversationTabContent lines={LINES} />);

    // react-markdown is lazy-loaded: allow for a slow first import.
    expect(await screen.findByText('présentez-vous', {}, { timeout: 10_000 })).toBeInTheDocument();
    const labels = screen.getAllByText(/^(Vous|Évaluateur)$/).map((el) => el.textContent);
    expect(labels).toEqual(['Évaluateur', 'Évaluateur', 'Vous']);
    expect(screen.getByText('Je travaille à Lyon.')).toBeInTheDocument();
  });

  it('renders the examiner text as Markdown and the candidate text as is', async () => {
    render(
      <ConversationTabContent
        lines={[
          { id: 'x', text: '**gras**', isLocal: true, timestamp: 1 },
          { id: 'y', text: '**gras**', isLocal: false, timestamp: 2 },
        ]}
      />
    );
    const strong = await screen.findByText('gras', {}, { timeout: 10_000 });
    expect(strong.tagName).toBe('STRONG');
    expect(screen.getByText('**gras**')).toBeInTheDocument();
  });

  it('shows an ellipsis while the examiner line is still empty', () => {
    render(<ConversationTabContent lines={[LINES[2]]} />);
    expect(screen.getByText('…')).toBeInTheDocument();
  });

  it('renders nothing without lines', () => {
    render(<ConversationTabContent lines={[]} />);
    expect(screen.queryByText(/Vous|Évaluateur/)).not.toBeInTheDocument();
  });

  it('keeps following new lines only while scrolled near the bottom', () => {
    const { container, rerender } = render(<ConversationTabContent lines={LINES} />);
    const scroller = container.firstElementChild as HTMLDivElement;
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo;
    const withLine = (id: string, timestamp: number) => [
      ...LINES,
      { id, text: `Ligne ${id}`, isLocal: false, timestamp },
    ];

    rerender(<ConversationTabContent lines={withLine('d', 4)} />);
    expect(scrollTo).toHaveBeenCalled();

    // The candidate scrolls back up to reread: new lines no longer pull the view down.
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 5000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 600 });
    scroller.scrollTop = 0;
    act(() => {
      scroller.dispatchEvent(new Event('scroll'));
    });
    scrollTo.mockClear();

    rerender(<ConversationTabContent lines={withLine('e', 5)} />);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
