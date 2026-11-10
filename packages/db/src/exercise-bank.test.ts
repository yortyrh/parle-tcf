import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  FRENCH_MONTH_SLUGS,
  TACHE1_ENTRETIEN_ID,
  contentHash,
  exerciseIdFor,
  monthPageUrl,
  normalizeSubjectText,
  parseMonthPageUrl,
  parseSourceRef,
  sessionDate,
  sourceRef,
} from './exercise-bank';
import * as dbIndex from './index';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

describe('normalizeSubjectText', () => {
  it('returns an already clean text unchanged', () => {
    expect(normalizeSubjectText('Je suis votre voisin.')).toBe('Je suis votre voisin.');
  });

  it('applies NFC normalization', () => {
    const decomposed = "Café de l'école";
    const out = normalizeSubjectText(decomposed);
    expect(out).toBe("Café de l'école");
    expect(out.length).toBe(15);
  });

  it('turns no-break spaces (U+00A0, U+202F) into plain spaces', () => {
    expect(normalizeSubjectText('a b')).toBe('a b');
    expect(normalizeSubjectText('Pourquoi ?')).toBe('Pourquoi ?');
  });

  it('collapses a run mixing no-break spaces and other whitespace', () => {
    expect(normalizeSubjectText('a   \t b')).toBe('a b');
  });

  it('collapses every whitespace run to one space and trims', () => {
    expect(normalizeSubjectText('  Un\t\tdeux \n\r\n trois   ')).toBe('Un deux trois');
    expect(normalizeSubjectText('\n\nligne\n')).toBe('ligne');
  });

  it('maps typographic apostrophes to a straight apostrophe', () => {
    expect(normalizeSubjectText('l’été')).toBe("l'été");
    expect(normalizeSubjectText('‘cité')).toBe("'cité");
    expect(normalizeSubjectText('aʼb')).toBe("a'b");
    expect(normalizeSubjectText("d'abord")).toBe("d'abord");
  });

  it('maps curly double quotes to straight ones but keeps French guillemets', () => {
    expect(normalizeSubjectText('“bonjour”')).toBe('"bonjour"');
    expect(normalizeSubjectText('« bonjour »')).toBe('« bonjour »');
  });

  it('keeps the case', () => {
    expect(normalizeSubjectText('  ÉCOLE et école ')).toBe('ÉCOLE et école');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeSubjectText('')).toBe('');
    expect(normalizeSubjectText('   \n\t ')).toBe('');
  });

  it('is idempotent', () => {
    const messy = '  Vous m’interrogez “sur”  la\nville !  ';
    const once = normalizeSubjectText(messy);
    expect(once).toBe('Vous m\'interrogez "sur" la ville !');
    expect(normalizeSubjectText(once)).toBe(once);
  });
});

describe('contentHash', () => {
  it('is the lowercase hex SHA-256 of the normalized text', () => {
    expect(contentHash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(contentHash('  abc \n')).toBe(contentHash('abc'));
    const text = '  Je suis votre voisin’  ';
    expect(contentHash(text)).toBe(sha256(normalizeSubjectText(text)));
  });

  it('returns 64 lowercase hex characters', () => {
    const h = contentHash('ÉCOLE « test »');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes equal for texts differing only by whitespace, nbsp or apostrophe style', () => {
    const a = "Vous m'interrogez sur la vie au Canada.";
    const b = '  Vous m’interrogez  sur la\nvie au Canada. ';
    expect(contentHash(b)).toBe(contentHash(a));
  });

  it('hashes differently when the case differs', () => {
    expect(contentHash('Bonjour')).not.toBe(contentHash('bonjour'));
  });

  it('hashes differently when guillemets differ from straight quotes', () => {
    expect(contentHash('«x»')).not.toBe(contentHash('"x"'));
  });
});

describe('sourceRef', () => {
  it('formats the spec example', () => {
    expect(sourceRef({ year: 2025, month: 12, task: 2, part: 4, position: 1 })).toBe(
      '2025-12-t2-p004-s001'
    );
  });

  it('zero-pads month, part and position', () => {
    expect(sourceRef({ year: 2000, month: 1, task: 1, part: 1, position: 1 })).toBe(
      '2000-01-t1-p001-s001'
    );
    expect(sourceRef({ year: 2024, month: 9, task: 3, part: 42, position: 17 })).toBe(
      '2024-09-t3-p042-s017'
    );
    expect(sourceRef({ year: 2100, month: 12, task: 3, part: 999, position: 999 })).toBe(
      '2100-12-t3-p999-s999'
    );
  });

  const valid = { year: 2025, month: 6, task: 2, part: 5, position: 7 };

  it.each([
    ['year 1999', { year: 1999 }],
    ['year 2101', { year: 2101 }],
    ['month 0', { month: 0 }],
    ['month 13', { month: 13 }],
    ['task 0', { task: 0 }],
    ['task 4', { task: 4 }],
    ['task 1.5', { task: 1.5 }],
    ['part 0', { part: 0 }],
    ['part 1000', { part: 1000 }],
    ['part 1.5', { part: 1.5 }],
    ['part NaN', { part: Number.NaN }],
    ['position 0', { position: 0 }],
    ['position 1000', { position: 1000 }],
    ['position 2.5', { position: 2.5 }],
    ['position -1', { position: -1 }],
  ])('throws a RangeError naming the field for %s', (_label, override) => {
    const [[field, value]] = Object.entries(override);
    expect(() => sourceRef({ ...valid, ...override })).toThrow(RangeError);
    expect(() => sourceRef({ ...valid, ...override })).toThrow(
      new RangeError(`Invalid ${field} ${String(value)}`)
    );
  });

  it.each([
    ['year 2000', { year: 2000 }, '2000-06-t2-p005-s007'],
    ['year 2100', { year: 2100 }, '2100-06-t2-p005-s007'],
    ['month 1', { month: 1 }, '2025-01-t2-p005-s007'],
    ['month 12', { month: 12 }, '2025-12-t2-p005-s007'],
    ['task 1', { task: 1 }, '2025-06-t1-p005-s007'],
    ['task 3', { task: 3 }, '2025-06-t3-p005-s007'],
    ['part 1', { part: 1 }, '2025-06-t2-p001-s007'],
    ['part 999', { part: 999 }, '2025-06-t2-p999-s007'],
    ['position 1', { position: 1 }, '2025-06-t2-p005-s001'],
    ['position 999', { position: 999 }, '2025-06-t2-p005-s999'],
  ])('accepts the boundary %s', (_label, override, expected) => {
    expect(sourceRef({ ...valid, ...override })).toBe(expected);
  });
});

describe('parseSourceRef', () => {
  it('parses a valid reference into numbers', () => {
    expect(parseSourceRef('2025-12-t2-p004-s001')).toEqual({
      year: 2025,
      month: 12,
      task: 2,
      part: 4,
      position: 1,
    });
    expect(parseSourceRef('2023-01-t3-p999-s010')).toEqual({
      year: 2023,
      month: 1,
      task: 3,
      part: 999,
      position: 10,
    });
    expect(parseSourceRef('2024-05-t1-p001-s001')).toEqual({
      year: 2024,
      month: 5,
      task: 1,
      part: 1,
      position: 1,
    });
  });

  it.each([
    '',
    '2025-00-t2-p001-s001',
    '2025-13-t2-p001-s001',
    '2025-12-t0-p001-s001',
    '2025-12-t4-p001-s001',
    '2025-12-t2-p000-s001',
    '2025-12-t2-p001-s000',
    '2025-1-t2-p001-s001',
    '25-12-t2-p001-s001',
    '2025-12-t2-p01-s001',
    '2025-12-t2-p0001-s001',
    '2025-12-t2-p001-s0001',
    '2025-12-T2-p001-s001',
    '2025-12-t2-P001-s001',
    ' 2025-12-t2-p001-s001',
    '2025-12-t2-p001-s001 ',
    'x2025-12-t2-p001-s001',
    '2025-12-t2-p001-s001x',
    '2025-12-t2-p001-s001\n',
    '2025_12-t2-p001-s001',
    't1-entretien',
  ])('returns null for %j', (ref) => {
    expect(parseSourceRef(ref)).toBeNull();
  });

  it('round-trips with sourceRef', () => {
    const samples = [
      { year: 2000, month: 1, task: 1, part: 1, position: 1 },
      { year: 2025, month: 12, task: 2, part: 4, position: 1 },
      { year: 2022, month: 8, task: 3, part: 120, position: 35 },
      { year: 2100, month: 12, task: 3, part: 999, position: 999 },
    ];
    for (const s of samples) {
      expect(parseSourceRef(sourceRef(s))).toEqual(s);
    }
    for (const ref of ['2025-12-t2-p004-s001', '2022-07-t3-p010-s100']) {
      const parsed = parseSourceRef(ref);
      expect(parsed).not.toBeNull();
      expect(sourceRef(parsed!)).toBe(ref);
    }
  });
});

describe('exerciseIdFor', () => {
  it('prefixes the task and keeps the first 16 hash characters', () => {
    expect(exerciseIdFor(2, '0123456789abcdef0123456789abcdef')).toBe('t2-0123456789abcdef');
    expect(exerciseIdFor(3, 'fedcba9876543210ffff')).toBe('t3-fedcba9876543210');
  });

  it('works with a real content hash', () => {
    const h = contentHash('Sujet de test');
    const id = exerciseIdFor(3, h);
    expect(id).toBe(`t3-${h.slice(0, 16)}`);
    expect(id).toHaveLength(19);
  });
});

describe('sessionDate', () => {
  it('returns the first day of the month as YYYY-MM-01', () => {
    expect(sessionDate(2025, 3)).toBe('2025-03-01');
    expect(sessionDate(2025, 12)).toBe('2025-12-01');
    expect(sessionDate(2000, 1)).toBe('2000-01-01');
    expect(sessionDate(2024, 10)).toBe('2024-10-01');
  });
});

describe('FRENCH_MONTH_SLUGS', () => {
  it('lists the twelve unaccented month slugs, January first', () => {
    expect(FRENCH_MONTH_SLUGS).toEqual([
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
    ]);
  });
});

describe('monthPageUrl', () => {
  it.each(
    [
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
    ].map((slug, i) => [i + 1, slug] as const)
  )('builds the page URL of month %i (%s)', (month, slug) => {
    expect(monthPageUrl(2025, month)).toBe(
      `https://reussir-tcfcanada.com/${slug}-2025-expression-orale/`
    );
  });

  it('uses the given year', () => {
    expect(monthPageUrl(2023, 8)).toBe('https://reussir-tcfcanada.com/aout-2023-expression-orale/');
  });
});

describe('parseMonthPageUrl', () => {
  it('parses the canonical page URL', () => {
    expect(
      parseMonthPageUrl('https://reussir-tcfcanada.com/decembre-2025-expression-orale/')
    ).toEqual({ year: 2025, month: 12 });
  });

  it('round-trips with monthPageUrl for every month', () => {
    for (let month = 1; month <= 12; month++) {
      expect(parseMonthPageUrl(monthPageUrl(2024, month))).toEqual({
        year: 2024,
        month,
      });
    }
  });

  it.each([
    [
      'no trailing slash',
      'https://reussir-tcfcanada.com/janvier-2025-expression-orale',
      { year: 2025, month: 1 },
    ],
    ['http', 'http://reussir-tcfcanada.com/mars-2024-expression-orale/', { year: 2024, month: 3 }],
    [
      'www host',
      'https://www.reussir-tcfcanada.com/juin-2023-expression-orale/',
      { year: 2023, month: 6 },
    ],
    [
      'a query string',
      'https://reussir-tcfcanada.com/mai-2025-expression-orale/?utm_source=x&a=1',
      { year: 2025, month: 5 },
    ],
    [
      'a hash',
      'https://reussir-tcfcanada.com/avril-2025-expression-orale/#tache-2',
      { year: 2025, month: 4 },
    ],
    [
      'an accented slug (février)',
      'https://reussir-tcfcanada.com/février-2025-expression-orale/',
      { year: 2025, month: 2 },
    ],
    [
      'a capitalized accented slug (Août)',
      'https://reussir-tcfcanada.com/Août-2024-expression-orale/',
      { year: 2024, month: 8 },
    ],
    [
      'an accented slug (décembre)',
      'https://reussir-tcfcanada.com/décembre-2022-expression-orale/',
      { year: 2022, month: 12 },
    ],
    [
      'an upper-case slug',
      'https://reussir-tcfcanada.com/SEPTEMBRE-2025-expression-orale/',
      { year: 2025, month: 9 },
    ],
    [
      'the first accepted year (2000)',
      'https://reussir-tcfcanada.com/janvier-2000-expression-orale/',
      { year: 2000, month: 1 },
    ],
    [
      'the last accepted year (2100)',
      'https://reussir-tcfcanada.com/decembre-2100-expression-orale/',
      { year: 2100, month: 12 },
    ],
  ])('accepts %s', (_label, url, expected) => {
    expect(parseMonthPageUrl(url)).toEqual(expected);
  });

  // Interpretation: an href with a percent-encoded accent is the same URL as the raw one.
  it('accepts a percent-encoded accented slug', () => {
    expect(
      parseMonthPageUrl('https://reussir-tcfcanada.com/f%C3%A9vrier-2025-expression-orale/')
    ).toEqual({ year: 2025, month: 2 });
  });

  it.each([
    ['another host', 'https://example.com/decembre-2025-expression-orale/'],
    ['another subdomain', 'https://blog.reussir-tcfcanada.com/decembre-2025-expression-orale/'],
    [
      'a look-alike host',
      'https://reussir-tcfcanada.com.evil.test/decembre-2025-expression-orale/',
    ],
    [
      'a look-alike host prefix',
      'https://notreussir-tcfcanada.com/decembre-2025-expression-orale/',
    ],
    [
      'the written-expression page',
      'https://reussir-tcfcanada.com/decembre-2025-expression-ecrite/',
    ],
    ['an unknown month', 'https://reussir-tcfcanada.com/decembr-2025-expression-orale/'],
    ['a two-digit year', 'https://reussir-tcfcanada.com/decembre-25-expression-orale/'],
    ['a five-digit year', 'https://reussir-tcfcanada.com/decembre-20255-expression-orale/'],
    ['a non-numeric year', 'https://reussir-tcfcanada.com/decembre-abcd-expression-orale/'],
    [
      'an extra path prefix',
      'https://reussir-tcfcanada.com/2025/12/decembre-2025-expression-orale/',
    ],
    [
      'an extra path suffix',
      'https://reussir-tcfcanada.com/decembre-2025-expression-orale/sujet-1/',
    ],
    ['a suffixed slug', 'https://reussir-tcfcanada.com/decembre-2025-expression-orale-2/'],
    ['the index page', 'https://reussir-tcfcanada.com/expression-orale/'],
    ['another protocol', 'ftp://reussir-tcfcanada.com/decembre-2025-expression-orale/'],
    ['a relative path', '/decembre-2025-expression-orale/'],
    ['an invalid URL string', 'not a url'],
    ['an empty string', ''],
    ['a malformed percent escape', 'https://reussir-tcfcanada.com/%E0%A4%A-2025-expression-orale/'],
    ['a year before 2000', 'https://reussir-tcfcanada.com/decembre-1999-expression-orale/'],
    ['a year after 2100', 'https://reussir-tcfcanada.com/decembre-2101-expression-orale/'],
  ])('returns null for %s', (_label, url) => {
    expect(parseMonthPageUrl(url)).toBeNull();
  });
});

describe('TACHE1_ENTRETIEN_ID', () => {
  it('is the fixed tâche 1 exercise id', () => {
    expect(TACHE1_ENTRETIEN_ID).toBe('t1-entretien');
  });
});

describe('package entry point', () => {
  it('re-exports the exercise bank helpers', () => {
    expect(dbIndex.contentHash).toBe(contentHash);
    expect(dbIndex.normalizeSubjectText).toBe(normalizeSubjectText);
    expect(dbIndex.sourceRef).toBe(sourceRef);
    expect(dbIndex.parseSourceRef).toBe(parseSourceRef);
    expect(dbIndex.exerciseIdFor).toBe(exerciseIdFor);
    expect(dbIndex.sessionDate).toBe(sessionDate);
    expect(dbIndex.monthPageUrl).toBe(monthPageUrl);
    expect(dbIndex.parseMonthPageUrl).toBe(parseMonthPageUrl);
    expect(dbIndex.FRENCH_MONTH_SLUGS).toBe(FRENCH_MONTH_SLUGS);
    expect(dbIndex.TACHE1_ENTRETIEN_ID).toBe(TACHE1_ENTRETIEN_ID);
  });
});
