'use client';

import { useEffect, useRef } from 'react';
import { type ShortcutAction, shortcutFor } from '@/lib/shortcuts';

/**
 * Global keyboard shortcuts of a live session (see lib/shortcuts.ts). Handlers
 * are read from a ref, so callers can pass inline functions.
 */
export function useSessionShortcuts(
  handlers: Partial<Record<ShortcutAction, () => void>>,
  enabled = true
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const action = shortcutFor({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        repeat: event.repeat,
        targetTag: target?.tagName,
        targetEditable: target?.isContentEditable,
      });
      const handler = action ? handlersRef.current[action] : undefined;
      if (!handler) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
