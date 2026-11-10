export type ShortcutAction = 'toggle-mic' | 'skip-preparation' | 'show-shortcuts';

export const SHORTCUTS: { key: string; action: ShortcutAction; label: string }[] = [
  { key: 'M', action: 'toggle-mic', label: 'Activer ou couper le micro' },
  { key: 'S', action: 'skip-preparation', label: 'Passer la préparation' },
  { key: '?', action: 'show-shortcuts', label: 'Afficher les raccourcis' },
];

export interface ShortcutEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  targetTag?: string;
  targetEditable?: boolean;
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Session keyboard shortcuts; never fires while typing or with a modifier. */
export function shortcutFor(e: ShortcutEvent): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.targetEditable) return null;
  if (e.targetTag && TYPING_TAGS.has(e.targetTag.toUpperCase())) return null;
  switch (e.key) {
    case 'm':
    case 'M':
      return 'toggle-mic';
    case 's':
    case 'S':
      return 'skip-preparation';
    case '?':
      return 'show-shortcuts';
    default:
      return null;
  }
}
