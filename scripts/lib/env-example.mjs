/**
 * Pure helpers for `pnpm env-schema:check`: every variable of the API env
 * schema must be documented in apps/api/.env.example (set or commented out).
 */

const ENTRY = /^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/;

/** Variable names an .env example documents, set or commented out, in order, without duplicates. */
export function exampleKeys(text) {
  const keys = [];
  for (const line of text.split(/\r?\n/)) {
    const match = ENTRY.exec(line);
    if (match && !keys.includes(match[1])) keys.push(match[1]);
  }
  return keys;
}

/** Schema keys missing from the example, in schema order; `ignore` lists keys that need no doc. */
export function missingEnvKeys(schemaKeys, exampleText, { ignore = [] } = {}) {
  const documented = new Set(exampleKeys(exampleText));
  return schemaKeys.filter((key) => !ignore.includes(key) && !documented.has(key));
}
