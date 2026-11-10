/**
 * Source-code transforms used by the scaffold scripts (scripts/scaffold.mjs).
 * Pure and idempotent: applying a transform twice gives the same result as once.
 * Each throws when the anchor it edits is missing, so a refactor of the target file
 * fails the scaffold loudly instead of silently producing broken code.
 */

const KNOWN_EXTENSION = /\.(js|mjs|cjs|json)$/;
const RELATIVE_SPECIFIER = /(\bfrom\s*|\bimport\s+)(["'])(\.\.?\/[^"']*)\2/g;

/**
 * Adds `.js` to relative import/export specifiers that have no JS/JSON extension
 * (NestJS schematics emit extensionless imports; the API is ESM with Node16 resolution).
 * @param {string} source
 */
export function addJsExtensions(source) {
  return source.replace(RELATIVE_SPECIFIER, (match, prefix, quote, specifier) =>
    KNOWN_EXTENSION.test(specifier) ? match : `${prefix}${quote}${specifier}.js${quote}`
  );
}

/**
 * Adds `export * from "./schemas/<kebab>";` after the last schema export of
 * packages/shared/src/index.ts.
 * @param {string} indexSource
 * @param {string} kebab
 */
export function addSharedExport(indexSource, kebab) {
  const line = `export * from "./schemas/${kebab}";`;
  const lines = indexSource.split('\n');
  if (lines.includes(line)) return indexSource;
  const isSchemaExport = (l) => /^export \* from ["']\.\/schemas\/[^"']+["'];?\s*$/.test(l);
  let last = -1;
  lines.forEach((l, i) => {
    if (isSchemaExport(l)) last = i;
  });
  if (last === -1)
    throw new Error('No `export * from "./schemas/..."` line found in the shared index.');
  lines.splice(last + 1, 0, line);
  return lines.join('\n');
}

/**
 * Index of the brace that closes the one at `openIndex` (string literals are skipped).
 * @param {string} source
 * @param {number} openIndex
 */
function matchingBrace(source, openIndex) {
  let depth = 0;
  let quote = null;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  throw new Error('Unbalanced braces in source.');
}

/**
 * Inserts `entry` (one line, without indentation) as the last property of the object
 * literal whose opening brace is at `openIndex`.
 */
function appendObjectEntry(source, openIndex, entry) {
  const close = matchingBrace(source, openIndex);
  const before = source.slice(0, close).replace(/\s*$/, '');
  const needsComma = !before.endsWith(',') && !before.endsWith('{');
  const lineStart = source.lastIndexOf('\n', close) + 1;
  const closingIndent = source.slice(lineStart, close).match(/^\s*/)[0];
  return `${before}${needsComma ? ',' : ''}\n${closingIndent}  ${entry}\n${closingIndent}${source.slice(close)}`;
}

/**
 * Adds `<camel>List: "/<kebab>/list"` as the last entry of `API_ROUTES`.
 * @param {string} indexSource
 * @param {{ kebab: string, camel: string }} names
 */
export function addApiRoute(indexSource, { kebab, camel }) {
  const anchor = 'export const API_ROUTES = {';
  const start = indexSource.indexOf(anchor);
  if (start === -1) throw new Error('`export const API_ROUTES = {` not found in the shared index.');
  const open = start + anchor.length - 1;
  const body = indexSource.slice(open, matchingBrace(indexSource, open));
  if (new RegExp(`^\\s*${camel}List\\s*:`, 'm').test(body)) return indexSource;
  return appendObjectEntry(indexSource, open, `${camel}List: "/${kebab}/list",`);
}

/**
 * Declares `<camel>ListProcedure` in the oRPC contract and registers it in the router.
 * @param {string} contractSource
 * @param {{ kebab: string, camel: string, pascal: string }} names
 */
export function addContractProcedure(contractSource, { camel, pascal }) {
  const procedure = `${camel}ListProcedure`;
  if (new RegExp(`\\bconst ${procedure}\\b`).test(contractSource)) return contractSource;

  const sharedImport = /import\s*\{([^}]*)\}\s*from\s*(["'])@parle-tcf\/shared\2;/;
  const importMatch = contractSource.match(sharedImport);
  if (!importMatch)
    throw new Error('No `import { ... } from "@parle-tcf/shared"` in the contract.');
  const contractAnchor = 'export const examContract';
  if (!contractSource.includes(contractAnchor))
    throw new Error('`export const examContract` not found.');
  const routerAnchor = 'populateContractRouterPaths({';
  if (!contractSource.includes(routerAnchor))
    throw new Error('`populateContractRouterPaths({` not found.');

  // 1. Named imports from @parle-tcf/shared.
  const inputSchema = `list${pascal}InputSchema`;
  const outputSchema = `list${pascal}OutputSchema`;
  const existing = importMatch[1]
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const merged = [...existing, ...[inputSchema, outputSchema].filter((n) => !existing.includes(n))];
  const newImport = `import {\n${merged.map((n) => `  ${n},`).join('\n')}\n} from ${importMatch[2]}@parle-tcf/shared${importMatch[2]};`;
  let out = contractSource.replace(sharedImport, newImport);

  // 2. Procedure declaration before the router.
  const declaration =
    `export const ${procedure} = post(API_ROUTES.${camel}List)\n` +
    `  .input(${inputSchema})\n` +
    `  .output(${outputSchema});\n\n`;
  out = out.replace(contractAnchor, `${declaration}${contractAnchor}`);

  // 3. Router entry.
  const routerOpen = out.lastIndexOf(routerAnchor) + routerAnchor.length - 1;
  return appendObjectEntry(out, routerOpen, `${camel}: { list: ${procedure} },`);
}
