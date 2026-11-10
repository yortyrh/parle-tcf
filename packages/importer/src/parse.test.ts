import { describe, expect, it } from 'vitest';
import { monthPageUrl } from '@parle-tcf/db';
import { discoverMonthPages, parseMonthPage } from './parse';

// Synthetic fixtures written for these tests (not copied from any real page).
const S = {
  a: 'Je suis un collègue. Vous me demandez comment fonctionne la cantine.',
  b: 'Je suis libraire. Vous cherchez un roman pour votre neveu de douze ans.',
  c: 'Je suis agent immobilier. Vous voulez louer un studio près du centre.',
  d: 'Je travaille à la mairie. Vous voulez inscrire votre enfant au sport.',
  e: 'Faut-il limiter le temps passé devant les écrans chez les adolescents ?',
  f: 'Le télétravail rend-il les employés plus heureux ? Donnez votre avis.',
  g: 'Les voyages forment-ils vraiment la jeunesse ? Justifiez votre réponse.',
};

const strong = (t: string) => `<p><strong>${t}</strong></p>`;

describe('parseMonthPage', () => {
  it('parses the spec example', () => {
    const html =
      '<h2>Tâche 2</h2><h3>Partie 1</h3><p><strong>Je suis votre voisin. <span style="color: #00ccff;">Vous me posez des questions sur le quartier.</span></strong></p>';
    expect(parseMonthPage(html)).toEqual([
      {
        task: 2,
        part: 1,
        position: 1,
        text: 'Je suis votre voisin. Vous me posez des questions sur le quartier.',
        scenario: 'Je suis votre voisin.',
        instruction: 'Vous me posez des questions sur le quartier.',
        html: 'Je suis votre voisin. <span style="color: #00ccff;">Vous me posez des questions sur le quartier.</span>',
      },
    ]);
  });

  it('returns nothing for a page without task headings', () => {
    expect(parseMonthPage('')).toEqual([]);
    expect(parseMonthPage(`<h1>Sujets du mois</h1>${strong(S.a)}${strong(S.b)}`)).toEqual([]);
  });

  it('tracks task, part and position across headings and part markers', () => {
    const html = `
      <html><body>
      <h1>Sujets de mars</h1>
      ${strong('Ce texte en gras arrive avant toute tâche et doit être ignoré.')}
      <h2>Tâche 1</h2>
      ${strong('Présentez-vous en détail, parlez de votre famille et de vos loisirs.')}
      <h2>Tâche 2</h2>
      ${strong(S.a)}
      <p><strong>Partie 2</strong></p>
      ${strong(S.b)}
      ${strong(S.c)}
      <h3>Partie 3 :</h3>
      ${strong(S.d)}
      <p><b>Partie 5</b></p>
      ${strong(S.a)}
      <h2>Tache 3</h2>
      ${strong(S.e)}
      <h4>PARTIE 12</h4>
      ${strong(S.f)}
      <div><section>${strong(S.g)}</section></div>
      <p><strong>Partie2:</strong></p>
      ${strong(S.e)}
      </body></html>`;
    const out = parseMonthPage(html);
    expect(out.map((s) => [s.task, s.part, s.position, s.text])).toEqual([
      [2, 1, 1, S.a],
      [2, 2, 1, S.b],
      [2, 2, 2, S.c],
      [2, 3, 1, S.d],
      [2, 5, 1, S.a],
      [3, 1, 1, S.e],
      [3, 12, 1, S.f],
      [3, 12, 2, S.g],
      [3, 2, 1, S.e],
    ]);
  });

  it('ignores subjects after a Tâche 1 heading until the next Tâche 2/3 heading', () => {
    const html = `
      <h2>Tâche 2</h2>${strong(S.a)}
      <h2>Tâche 1</h2>${strong(S.b)}<h3>Partie 2</h3>${strong(S.c)}
      <h2>Tâche 3</h2>${strong(S.e)}`;
    expect(parseMonthPage(html).map((s) => [s.task, s.part, s.position, s.text])).toEqual([
      [2, 1, 1, S.a],
      [3, 1, 1, S.e],
    ]);
  });

  it('resets part to 1 and the position counter on a new task heading', () => {
    const html = `
      <h2>Tâche 2</h2><h3>Partie 4</h3>${strong(S.a)}${strong(S.b)}
      <h2>Tâche 3</h2>${strong(S.e)}
      <h2>Tâche 2</h2>${strong(S.c)}`;
    expect(parseMonthPage(html).map((s) => [s.task, s.part, s.position])).toEqual([
      [2, 4, 1],
      [2, 4, 2],
      [3, 1, 1],
      [2, 1, 1],
    ]);
  });

  it('recognizes task headings at every level and in several spellings', () => {
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const html = `<h${level}>Tâche 3</h${level}>${strong(S.e)}`;
      expect(parseMonthPage(html).map((s) => s.task)).toEqual([3]);
    }
    for (const heading of [
      'TÂCHE 2',
      'tache 2',
      'Tâche2',
      'Tâche&nbsp;2',
      '  Tâche   2 : interaction  ',
      'Sujets de la tâche 2',
    ]) {
      const html = `<h2>${heading}</h2>${strong(S.a)}`;
      expect(
        parseMonthPage(html).map((s) => s.task),
        heading
      ).toEqual([2]);
    }
  });

  it('does not treat a bold task label as a task heading', () => {
    const html = `<p><strong>Tâche 2</strong></p>${strong(S.a)}`;
    expect(parseMonthPage(html)).toEqual([]);
  });

  it("only treats a whole-text 'Partie N' as a part marker", () => {
    const longPart = 'Partie 1 : le logement et les voisins du quartier';
    const html = `
      <h2>Tâche 2</h2><h3>Partie 7</h3>
      ${strong(longPart)}
      ${strong(S.a)}`;
    expect(parseMonthPage(html).map((s) => [s.part, s.position, s.text])).toEqual([
      [7, 1, longPart],
      [7, 2, S.a],
    ]);
  });

  it('does not count part markers as subjects', () => {
    const html = `<h2>Tâche 2</h2><p><strong>Partie 3</strong></p>${strong(S.a)}`;
    const out = parseMonthPage(html);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ part: 3, position: 1, text: S.a });
  });

  it('requires at least 30 characters of normalized text', () => {
    const len29 = 'abcdefghij abcdefghij abcdefg';
    const len30 = 'abcdefghij abcdefghij abcdefgh';
    expect(len29).toHaveLength(29);
    expect(len30).toHaveLength(30);
    const padded29 = `   ${'x'.repeat(14)} \n\t  ${'y'.repeat(14)}   `;
    const html = `<h2>Tâche 2</h2>${strong(len29)}${strong(len30)}${strong(padded29)}`;
    expect(parseMonthPage(html).map((s) => s.text)).toEqual([len30]);
  });

  it('ignores strong elements inside headings', () => {
    const html = `
      <h2>Tâche 2</h2>
      <h3><strong>Un titre en gras bien assez long pour compter comme sujet</strong></h3>
      ${strong(S.a)}`;
    expect(parseMonthPage(html).map((s) => s.text)).toEqual([S.a]);
  });

  it('counts a nested strong only once, with the outer text', () => {
    const inner = 'et cette partie intérieure dépasse elle aussi trente caractères';
    const html = `<h2>Tâche 3</h2><p><strong>Texte extérieur du sujet <strong>${inner}</strong> fin.</strong></p>`;
    const out = parseMonthPage(html);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe(`Texte extérieur du sujet ${inner} fin.`);
  });

  it('does not take b elements as subjects', () => {
    const html = `<h2>Tâche 2</h2><p><b>${S.a}</b></p>${strong(S.b)}`;
    expect(parseMonthPage(html).map((s) => s.text)).toEqual([S.b]);
  });

  it('normalizes the text and keeps the trimmed inner HTML', () => {
    const html = `<h2>Tâche 2</h2><p><strong>
        Please read   the <em>whole</em>&nbsp;subject before you answer it.
      </strong></p>`;
    const [s] = parseMonthPage(html);
    expect(s.text).toBe('Please read the whole subject before you answer it.');
    expect(s.html.startsWith('Please read   the <em>whole</em>')).toBe(true);
    expect(s.html.endsWith('before you answer it.')).toBe(true);
  });

  it('normalizes typographic apostrophes in the text', () => {
    const html = `<h2>Tâche 2</h2>${strong('Vous m’interrogez sur l’emploi du temps de l’école.')}`;
    expect(parseMonthPage(html)[0].text).toBe(
      "Vous m'interrogez sur l'emploi du temps de l'école."
    );
  });

  it('splits instruction (#00ccff spans) from scenario', () => {
    const html = `<h2>Tâche 2</h2>
      <p><strong>Je suis guide touristique. <span style="color:#00CCFF">Vous me demandez le programme.</span> Le circuit dure deux jours. <span style="font-weight: bold; color:  #00ccff;">Vous posez des questions sur le prix.</span></strong></p>`;
    const [s] = parseMonthPage(html);
    expect(s).toMatchObject({
      text: 'Je suis guide touristique. Vous me demandez le programme. Le circuit dure deux jours. Vous posez des questions sur le prix.',
      instruction: 'Vous me demandez le programme. Vous posez des questions sur le prix.',
      scenario: 'Je suis guide touristique. Le circuit dure deux jours.',
    });
  });

  it('keeps other spans, and spans without a style, in the scenario', () => {
    const html = `<h2>Tâche 2</h2>
      <p><strong>Je suis <span style="color: red">votre voisin</span> et <span>votre ami</span>. <span style="color:#00ccff">Vous me posez des questions.</span></strong></p>`;
    const [s] = parseMonthPage(html);
    expect(s.instruction).toBe('Vous me posez des questions.');
    expect(s.scenario).toBe('Je suis votre voisin et votre ami.');
  });

  it("ignores a 'Partie N' that is neither a heading nor bold", () => {
    const html = `<h2>Tâche 2</h2>
      <p>Partie 4</p>
      <div>Partie 6</div>
      ${strong(S.a)}`;
    expect(parseMonthPage(html).map((x) => [x.part, x.position])).toEqual([[1, 1]]);
  });

  it('finds instruction spans nested deeper in the subject', () => {
    const html = `<h2>Tâche 2</h2>
      <p><strong>Je suis votre banquier. <em><span style="color: #00ccff;">Vous voulez ouvrir un compte.</span></em></strong></p>`;
    const [s] = parseMonthPage(html);
    expect(s.instruction).toBe('Vous voulez ouvrir un compte.');
    expect(s.scenario).toBe('Je suis votre banquier.');
  });

  it('uses null scenario and instruction without a #00ccff span', () => {
    const html = `<h2>Tâche 2</h2>
      ${strong(S.a)}
      <p><strong>Je suis serveur. <span style="color: #ff0000;">Vous commandez un repas complet.</span></strong></p>`;
    const out = parseMonthPage(html);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ scenario: null, instruction: null });
    expect(out[1]).toMatchObject({
      text: 'Je suis serveur. Vous commandez un repas complet.',
      scenario: null,
      instruction: null,
    });
  });

  it('returns identical subjects of one page with their own positions', () => {
    const html = `<h2>Tâche 3</h2>${strong(S.e)}${strong(S.f)}${strong(S.e)}`;
    expect(parseMonthPage(html).map((s) => [s.position, s.text])).toEqual([
      [1, S.e],
      [2, S.f],
      [3, S.e],
    ]);
  });
});

describe('discoverMonthPages', () => {
  it('returns an empty list when nothing matches', () => {
    expect(discoverMonthPages('')).toEqual([]);
    expect(
      discoverMonthPages('<a href="https://example.com/decembre-2025-expression-orale/">x</a>')
    ).toEqual([]);
  });

  it('keeps month pages only, unique by month, newest first, with canonical URLs', () => {
    const html = `
      <nav>
        <a href="https://reussir-tcfcanada.com/novembre-2025-expression-orale/">Novembre</a>
        <a href="https://reussir-tcfcanada.com/decembre-2024-expression-orale/">Déc. 2024</a>
        <a href="https://reussir-tcfcanada.com/janvier-2025-expression-orale/">Janvier</a>
        <a href="https://www.reussir-tcfcanada.com/decembre-2025-expression-orale">Décembre (www)</a>
        <a href="https://reussir-tcfcanada.com/decembre-2025-expression-orale/">Décembre</a>
        <a href="http://reussir-tcfcanada.com/février-2025-expression-orale/?ref=menu">Février</a>
        <a href="https://reussir-tcfcanada.com/Août-2024-expression-orale/#haut">Août</a>
        <a href="https://reussir-tcfcanada.com/decembre-2025-expression-ecrite/">Écrit</a>
        <a href="https://example.com/mars-2025-expression-orale/">Ailleurs</a>
        <a href="https://reussir-tcfcanada.com/expression-orale/">Index</a>
        <a name="ancre">Sans lien</a>
        <a href="">Vide</a>
      </nav>`;
    expect(discoverMonthPages(html)).toEqual([
      { year: 2025, month: 12, url: monthPageUrl(2025, 12) },
      { year: 2025, month: 11, url: monthPageUrl(2025, 11) },
      { year: 2025, month: 2, url: monthPageUrl(2025, 2) },
      { year: 2025, month: 1, url: monthPageUrl(2025, 1) },
      { year: 2024, month: 12, url: monthPageUrl(2024, 12) },
      { year: 2024, month: 8, url: monthPageUrl(2024, 8) },
    ]);
  });

  it('skips links whose href is not a valid URL', () => {
    expect(
      discoverMonthPages(
        '<a href="http://[nope">x</a><a href="https://reussir-tcfcanada.com/mars-2025-expression-orale/">m</a>'
      )
    ).toEqual([{ year: 2025, month: 3, url: monthPageUrl(2025, 3) }]);
  });

  it('uses the unaccented https URL without www', () => {
    const [page] = discoverMonthPages(
      '<a href="http://www.reussir-tcfcanada.com/février-2023-expression-orale">x</a>'
    );
    expect(page).toEqual({
      year: 2023,
      month: 2,
      url: 'https://reussir-tcfcanada.com/fevrier-2023-expression-orale/',
    });
  });
});
