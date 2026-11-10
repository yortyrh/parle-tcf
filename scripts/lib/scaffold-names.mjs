/**
 * Name helpers for the scaffold scripts (scripts/scaffold.mjs).
 * Pure functions: no file system or process access.
 */

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Validates a kebab-case name and derives its camelCase and PascalCase forms.
 * @param {string} input
 * @returns {{ kebab: string, camel: string, pascal: string }}
 */
export function toNames(input) {
  if (typeof input !== 'string' || !KEBAB.test(input)) {
    throw new Error(
      `Invalid name "${input}": use kebab-case (lowercase letters, digits and single dashes, starting with a letter).`
    );
  }
  const parts = input.split('-');
  const pascal = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  const camel = pascal[0].toLowerCase() + pascal.slice(1);
  return { kebab: input, camel, pascal };
}

/**
 * Validates a web route made of kebab-case segments ("sujets/du-mois").
 * Leading and trailing slashes are ignored.
 * @param {string} route
 */
export function routeToNames(route) {
  const trimmed = String(route ?? '').replace(/^\/+|\/+$/g, '');
  if (trimmed === '') throw new Error('Invalid route: it must have at least one segment.');
  const segments = trimmed.split('/');
  for (const segment of segments) {
    try {
      toNames(segment);
    } catch {
      throw new Error(`Invalid route "${route}": segment "${segment}" is not kebab-case.`);
    }
  }
  return { route: trimmed, segments, ...toNames(segments.join('-')) };
}
