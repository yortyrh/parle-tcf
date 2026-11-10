import { type CheerioAPI, load } from 'cheerio';
import { type AnyNode, type Element, isTag } from 'domhandler';
import { monthPageUrl, normalizeSubjectText, parseMonthPageUrl } from '@parle-tcf/db';

export interface ParsedSubject {
  task: 2 | 3;
  part: number;
  position: number;
  text: string;
  html: string;
  scenario: string | null;
  instruction: string | null;
}

export const INDEX_URL = 'https://reussir-tcfcanada.com/expression-orale/';

const HEADING = /^h[1-6]$/;
const TASK = /t[âa]che\s*([123])/i;
const PART = /^partie\s*(\d+)\s*:?$/i;
const INSTRUCTION_COLOR = /color\s*:\s*#00ccff/i;
const MIN_SUBJECT_LENGTH = 30;

const isElement = (node: AnyNode): node is Element => isTag(node);

function instructionAndScenario($: CheerioAPI, el: Element) {
  const spans = $(el)
    .find('span')
    .filter((_, span) => INSTRUCTION_COLOR.test($(span).attr('style') ?? ''));
  if (spans.length === 0) return { instruction: null, scenario: null };
  const instruction = normalizeSubjectText(
    spans
      .toArray()
      .map((span) => $(span).text())
      .join(' ')
  );
  const clone = $(el).clone();
  clone.find('span').each((_, span) => {
    if (INSTRUCTION_COLOR.test($(span).attr('style') ?? '')) $(span).remove();
  });
  return {
    instruction: instruction || null,
    scenario: normalizeSubjectText(clone.text()) || null,
  };
}

/**
 * Extracts the Tâche 2 / Tâche 3 subjects of a monthly page, walking elements in
 * document order so page-builder nesting does not matter: a "Tâche N" heading sets
 * the task, "Partie N" sets the part, and each top-level <strong> is one subject.
 */
export function parseMonthPage(html: string): ParsedSubject[] {
  const $ = load(html);
  const subjects: ParsedSubject[] = [];
  let task: 2 | 3 | null = null;
  let part = 1;
  let position = 0;

  $('*').each((_, node) => {
    if (!isElement(node)) return;
    const tag = node.tagName.toLowerCase();
    const text = normalizeSubjectText($(node).text());

    if (HEADING.test(tag)) {
      const taskMatch = TASK.exec(text);
      if (taskMatch) {
        const n = Number(taskMatch[1]);
        task = n === 2 || n === 3 ? n : null;
        part = 1;
        position = 0;
        return;
      }
      const partMatch = PART.exec(text);
      if (partMatch) {
        part = Number(partMatch[1]);
        position = 0;
      }
      return;
    }

    if (tag !== 'strong' && tag !== 'b') return;
    if ($(node).parents('h1,h2,h3,h4,h5,h6').length > 0) return;

    const partMatch = PART.exec(text);
    if (partMatch) {
      part = Number(partMatch[1]);
      position = 0;
      return;
    }
    if (tag !== 'strong' || task === null) return;
    if ($(node).parents('strong').length > 0) return;
    if (text.length < MIN_SUBJECT_LENGTH) return;

    position += 1;
    subjects.push({
      task,
      part,
      position,
      text,
      html: ($(node).html() ?? '').trim(),
      ...instructionAndScenario($, node),
    });
  });

  return subjects;
}

/** Monthly oral-expression pages linked from the index page, newest first. */
export function discoverMonthPages(
  indexHtml: string
): { year: number; month: number; url: string }[] {
  const $ = load(indexHtml);
  const found = new Map<string, { year: number; month: number; url: string }>();
  $('a[href]').each((_, a) => {
    let href: string;
    try {
      href = new URL($(a).attr('href') ?? '', INDEX_URL).href;
    } catch {
      return;
    }
    const parsed = parseMonthPageUrl(href);
    if (!parsed) return;
    const key = `${parsed.year}-${parsed.month}`;
    if (!found.has(key))
      found.set(key, {
        ...parsed,
        url: monthPageUrl(parsed.year, parsed.month),
      });
  });
  return [...found.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}
