import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook } from '@testing-library/react';
import { useSessionShortcuts } from './useSessionShortcuts';

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('useSessionShortcuts', () => {
  it('runs the handler of the pressed shortcut and prevents the default action', () => {
    const toggleMic = vi.fn();
    const showShortcuts = vi.fn();
    renderHook(() =>
      useSessionShortcuts({ 'toggle-mic': toggleMic, 'show-shortcuts': showShortcuts })
    );

    const event = press('m');
    expect(toggleMic).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);

    press('?');
    expect(showShortcuts).toHaveBeenCalledTimes(1);
  });

  it('ignores keys without a handler and leaves their default action', () => {
    const toggleMic = vi.fn();
    renderHook(() => useSessionShortcuts({ 'toggle-mic': toggleMic }));

    expect(press('s').defaultPrevented).toBe(false);
    expect(press('x').defaultPrevented).toBe(false);
    expect(toggleMic).not.toHaveBeenCalled();
  });

  it('ignores modified keys and key repeat', () => {
    const toggleMic = vi.fn();
    renderHook(() => useSessionShortcuts({ 'toggle-mic': toggleMic }));

    press('m', { ctrlKey: true });
    press('m', { metaKey: true });
    press('m', { altKey: true });
    press('m', { repeat: true });
    expect(toggleMic).not.toHaveBeenCalled();
  });

  it('ignores keys typed in a form field', () => {
    const toggleMic = vi.fn();
    function Probe() {
      useSessionShortcuts({ 'toggle-mic': toggleMic });
      return <input aria-label="champ" />;
    }
    const { getByLabelText } = render(<Probe />);

    fireEvent.keyDown(getByLabelText('champ'), { key: 'm' });
    expect(toggleMic).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const toggleMic = vi.fn();
    renderHook(() => useSessionShortcuts({ 'toggle-mic': toggleMic }, false));
    press('m');
    expect(toggleMic).not.toHaveBeenCalled();
  });

  it('uses the latest handlers and removes the listener on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ handler }) => useSessionShortcuts({ 'toggle-mic': handler }),
      { initialProps: { handler: first } }
    );
    rerender({ handler: second });
    press('m');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    unmount();
    press('m');
    expect(second).toHaveBeenCalledTimes(1);
  });
});
