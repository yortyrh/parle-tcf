import { describe, expect, it } from 'vitest';
import { DEFAULT_REDIRECT, safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('keeps app-relative paths', () => {
    expect(safeRedirectPath('/tcf/tache2?x=1')).toBe('/tcf/tache2?x=1');
  });

  it.each(['https://evil.test', '//evil.test', '/\\evil', 'tcf', '/a\nb', null, 42])(
    'rejects %s',
    (value) => {
      expect(safeRedirectPath(value)).toBe(DEFAULT_REDIRECT);
    }
  );
});
