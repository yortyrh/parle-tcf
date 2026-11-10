import { createHash } from 'node:crypto';

/**
 * Identity rules of the exercise bank, shared by the CSV data migration
 * (scripts/exercises-csv-to-sql.mjs), the importer (packages/importer) and the API.
 */

export const TACHE1_ENTRETIEN_ID = 't1-entretien';

/** Display form of a subject: Unicode NFC, plain spaces and apostrophes, single spaces. */
export function normalizeSubjectText(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\u2019\u2018\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dedupe key: SHA-256 (hex) of the normalized text. Case-sensitive on purpose. */
export function contentHash(s: string): string {
  return createHash('sha256').update(normalizeSubjectText(s), 'utf8').digest('hex');
}

export interface SourceRefParts {
  year: number;
  month: number;
  task: number;
  part: number;
  position: number;
}

const inRange = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/** `YYYY-MM-tT-pPPP-sSSS`: where a subject sits on a monthly page. */
export function sourceRef({ year, month, task, part, position }: SourceRefParts): string {
  if (!inRange(year, 2000, 2100)) throw new RangeError(`Invalid year ${year}`);
  if (!inRange(month, 1, 12)) throw new RangeError(`Invalid month ${month}`);
  if (!inRange(task, 1, 3)) throw new RangeError(`Invalid task ${task}`);
  if (!inRange(part, 1, 999)) throw new RangeError(`Invalid part ${part}`);
  if (!inRange(position, 1, 999)) throw new RangeError(`Invalid position ${position}`);
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${year}-${pad(month, 2)}-t${task}-p${pad(part, 3)}-s${pad(position, 3)}`;
}

const SOURCE_REF = /^(\d{4})-(\d{2})-t([123])-p(\d{3})-s(\d{3})$/;

export function parseSourceRef(ref: string): SourceRefParts | null {
  const match = SOURCE_REF.exec(ref);
  if (!match) return null;
  const [year, month, task, part, position] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || part < 1 || position < 1) return null;
  return { year, month, task, part, position };
}

/** Id of an exercise created by the importer (CSV rows keep their historical id). */
export function exerciseIdFor(task: number, hash: string): string {
  return `t${task}-${hash.slice(0, 16)}`;
}

/** First day of the month, as stored in `first_seen_on` / `last_seen_on`. */
export function sessionDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export const FRENCH_MONTH_SLUGS = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
] as const;

const SITE_HOSTS = new Set(['reussir-tcfcanada.com', 'www.reussir-tcfcanada.com']);

export function monthPageUrl(year: number, month: number): string {
  return `https://reussir-tcfcanada.com/${FRENCH_MONTH_SLUGS[month - 1]}-${year}-expression-orale/`;
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** `{ year, month }` of a monthly oral-expression page URL, else null. */
export function parseMonthPageUrl(url: string): { year: number; month: number } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !SITE_HOSTS.has(parsed.hostname)) {
    return null;
  }
  let path: string;
  try {
    path = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  const match = /^\/([^/]+)-(\d{4})-expression-orale\/?$/.exec(path);
  if (!match) return null;
  const slug = stripAccents(match[1].toLowerCase());
  const index = (FRENCH_MONTH_SLUGS as readonly string[]).indexOf(slug);
  const year = Number(match[2]);
  if (index === -1 || year < 2000 || year > 2100) return null;
  return { year, month: index + 1 };
}
