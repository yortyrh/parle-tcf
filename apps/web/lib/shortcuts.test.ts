import { describe, expect, it } from 'vitest';
import { SHORTCUTS, type ShortcutAction, shortcutFor } from './shortcuts';

const ACTIONS: ShortcutAction[] = ['toggle-mic', 'skip-preparation', 'show-shortcuts'];

const KEYS: [string, ShortcutAction][] = [
  ['m', 'toggle-mic'],
  ['M', 'toggle-mic'],
  ['s', 'skip-preparation'],
  ['S', 'skip-preparation'],
  ['?', 'show-shortcuts'],
];

describe('shortcutFor', () => {
  it.each(KEYS)('maps %j to %s', (key, action) => {
    expect(shortcutFor({ key })).toBe(action);
  });

  it.each(KEYS)('maps %j with every guard explicitly off', (key, action) => {
    expect(
      shortcutFor({
        key,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        repeat: false,
        targetEditable: false,
        targetTag: 'DIV',
      })
    ).toBe(action);
  });

  it.each(['a', 'x', 'Escape', 'Enter', ' ', '/', 'F1', 'ArrowUp', 'mm', 'ms', ''])(
    'ignores %j',
    (key) => {
      expect(shortcutFor({ key })).toBeNull();
    }
  );

  it('allows Shift alone', () => {
    const shifted = { key: '?', shiftKey: true };
    expect(shortcutFor(shifted)).toBe('show-shortcuts');
    const upper = { key: 'M', shiftKey: true };
    expect(shortcutFor(upper)).toBe('toggle-mic');
  });

  describe.each(['ctrlKey', 'metaKey', 'altKey', 'repeat', 'targetEditable'] as const)(
    'with %s',
    (flag) => {
      it.each(KEYS)('ignores %j', (key) => {
        expect(shortcutFor({ key, [flag]: true })).toBeNull();
      });
    }
  );

  describe.each([
    'INPUT',
    'TEXTAREA',
    'SELECT',
    'input',
    'textarea',
    'select',
    'Input',
    'TextArea',
    'sElEcT',
  ])('in a %s', (targetTag) => {
    it.each(KEYS)('ignores %j', (key) => {
      expect(shortcutFor({ key, targetTag })).toBeNull();
    });
  });

  it.each(['DIV', 'BUTTON', 'BODY', 'button', 'a', 'OPTION', ''])(
    'fires in a %j element',
    (targetTag) => {
      expect(shortcutFor({ key: 'm', targetTag })).toBe('toggle-mic');
    }
  );
});

describe('SHORTCUTS', () => {
  it('has one entry per action', () => {
    expect(SHORTCUTS.map((s) => s.action).sort()).toEqual([...ACTIONS].sort());
  });

  it('has non-empty, distinct labels and keys', () => {
    for (const s of SHORTCUTS) {
      expect(s.label.trim()).not.toBe('');
      expect(s.key.trim()).not.toBe('');
    }
    expect(new Set(SHORTCUTS.map((s) => s.label)).size).toBe(SHORTCUTS.length);
    expect(new Set(SHORTCUTS.map((s) => s.key.toLowerCase())).size).toBe(SHORTCUTS.length);
  });

  it('lists keys that shortcutFor maps to the same action', () => {
    for (const s of SHORTCUTS) {
      expect(shortcutFor({ key: s.key })).toBe(s.action);
    }
  });
});
