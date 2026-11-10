import { describe, expect, it } from 'vitest';
import { formText } from './form';

describe('formText', () => {
  it('returns the string value of a field', () => {
    const form = new FormData();
    form.set('email', 'a@b.fr');
    expect(formText(form, 'email')).toBe('a@b.fr');
  });

  it('returns an empty string for a missing field', () => {
    expect(formText(new FormData(), 'email')).toBe('');
  });

  it('returns an empty string for a file field', () => {
    const form = new FormData();
    form.set('avatar', new Blob(['x']), 'a.png');
    expect(formText(form, 'avatar')).toBe('');
  });
});
