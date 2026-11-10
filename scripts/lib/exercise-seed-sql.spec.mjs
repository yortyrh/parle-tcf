import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  asc,
  contentHash,
  examAttempts,
  exerciseAliases,
  exerciseOccurrences,
  exerciseSessions,
  exercises,
  normalizeSubjectText,
  sql,
} from '@parle-tcf/db';
import { createTestDb } from '@parle-tcf/db/testing';
import { buildExerciseSeedSql } from './exercise-seed-sql.mjs';

const URL_DEC_A = 'https://reussir-tcfcanada.com/decembre-2025-expression-orale/';
const URL_DEC_B = "https://reussir-tcfcanada.com/l'avis-d'un-ami/";
const URL_NOV = 'https://reussir-tcfcanada.com/novembre-2025-expression-orale/';

const T1_PROMPT =
  'Entretien dirigé : présentation de soi, puis questions sur des sujets quotidiens.';

const VOISIN_CURLY = 'Je suis votre voisin. Vous me posez des questions sur l’immeuble.';
const VOISIN_NBSP = "Je suis votre voisin. Vous me posez  des questions sur l'immeuble.";
const VOISIN_NORMALIZED = "Je suis votre voisin. Vous me posez des questions sur l'immeuble.";
const ESCAPE_TEXT = "C'est l''avis  d'un ami « très » important ; -- pas un commentaire \\ $$ fin.";

const row = (id, taskType, content, url, imageUrl = '', isImageBased = 'FALSE') => ({
  id,
  taskType,
  content,
  url,
  imageUrl,
  isImageBased,
});

/** Small fixture: one cross-month duplicate group, one same-text-other-task row, junk rows. */
const FIXTURE = [
  row(
    '2025-12-t2-p001-s002',
    'Tâche 2',
    VOISIN_CURLY,
    URL_DEC_A,
    'https://img.test/dec.png',
    'TRUE'
  ),
  row('2025-12-t2-p001-s001', 'Tâche 2', ESCAPE_TEXT, URL_DEC_B),
  row('2025-11-t2-p002-s001', 'Tâche 2', VOISIN_NBSP, URL_NOV),
  row(
    '2025-12-t3-p001-s001',
    'Tâche 3',
    VOISIN_CURLY,
    URL_DEC_A,
    'https://img.test/t3.png',
    'TRUE'
  ),
  // Same id again: the first row wins.
  row('2025-12-t2-p001-s001', 'Tâche 2', 'Doublon qui doit être ignoré.', URL_DEC_A),
  // Skipped rows.
  row('pas-un-identifiant', 'Tâche 2', 'Identifiant invalide.', URL_DEC_A),
  row('2025-13-t2-p001-s001', 'Tâche 2', 'Mois invalide.', URL_DEC_A),
  row('2025-12-t1-p001-s001', 'Tâche 1', 'Tâche non gérée par la banque.', URL_DEC_A),
  row('2025-12-t2-p009-s001', 'Tâche 9', 'Type de tâche inconnu.', URL_DEC_A),
  row('2025-12-t2-p009-s002', 'Tâche 2', '  \n\t ', URL_DEC_A),
];

const CANON_VOISIN = '2025-11-t2-p002-s001';
const ALIAS_VOISIN = '2025-12-t2-p001-s002';
const ESCAPE_ID = '2025-12-t2-p001-s001';
const T3_ID = '2025-12-t3-p001-s001';

function statementsOf(text) {
  return text
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function runSql(db, text) {
  for (const stmt of statementsOf(text)) {
    await db.execute(sql.raw(stmt));
  }
}

async function snapshot(db) {
  const sessions = await db
    .select()
    .from(exerciseSessions)
    .orderBy(asc(exerciseSessions.year), asc(exerciseSessions.month));
  const sessionKey = new Map(
    sessions.map((s) => [s.id, `${s.year}-${String(s.month).padStart(2, '0')}`])
  );
  return {
    sessions: sessions.map((s) => ({
      year: s.year,
      month: s.month,
      sourceUrl: s.sourceUrl,
      fetchedAt: s.fetchedAt,
    })),
    sessionIds: sessions.map((s) => s.id),
    exercises: await db.select().from(exercises).orderBy(asc(exercises.id)),
    aliases: await db.select().from(exerciseAliases).orderBy(asc(exerciseAliases.aliasId)),
    occurrences: (
      await db.select().from(exerciseOccurrences).orderBy(asc(exerciseOccurrences.sourceRef))
    ).map((o) => ({ ...o, session: sessionKey.get(o.sessionId) })),
    attempts: (await db.select().from(examAttempts).orderBy(asc(examAttempts.startedAt))).map(
      (a) => ({ id: a.id, exerciseId: a.exerciseId })
    ),
  };
}

/** Rows written by the old CSV seed: CSV ids, raw prompts, no content hash. */
async function insertLegacyBank(db) {
  // Emulates the database between migrations 0002 and 0004 (hash still nullable).
  await db.execute(sql.raw(`ALTER TABLE "exercises" ALTER COLUMN "content_hash" DROP NOT NULL`));
  await db.insert(exercises).values([
    { id: ALIAS_VOISIN, task: 2, prompt: VOISIN_CURLY, sourceRow: 2 },
    {
      id: ESCAPE_ID,
      task: 2,
      prompt: 'ancien texte',
      sourceRow: 3,
      theme: 'avis',
    },
    { id: CANON_VOISIN, task: 2, prompt: VOISIN_NBSP, sourceRow: 4 },
    { id: T3_ID, task: 3, prompt: VOISIN_CURLY, sourceRow: 5 },
    { id: 't1-entretien', task: 1, prompt: T1_PROMPT },
    { id: 'legacy-orphan', task: 2, prompt: 'Sujet absent du CSV.' },
  ]);
}

async function insertAttempt(testDb, userId, exerciseId, startedAt) {
  const [a] = await testDb.db
    .insert(examAttempts)
    .values({
      userId,
      mode: 'practice',
      task: 2,
      provider: 'openai',
      model: 'x',
      exerciseId,
      startedAt,
    })
    .returning();
  return a.id;
}

describe('buildExerciseSeedSql (pure output)', () => {
  it('starts with the generated-by header', () => {
    const out = buildExerciseSeedSql(FIXTURE);
    expect(out.split('\n')[0].startsWith('-- Generated by scripts/exercises-csv-to-sql.mjs')).toBe(
      true
    );
  });

  it("separates statements with Drizzle's breakpoint marker", () => {
    const out = buildExerciseSeedSql(FIXTURE);
    expect(out).toContain('--> statement-breakpoint');
    expect(statementsOf(out).length).toBeGreaterThan(1);
  });

  it('is deterministic', () => {
    const a = buildExerciseSeedSql(FIXTURE);
    const b = buildExerciseSeedSql(structuredClone(FIXTURE));
    expect(b).toBe(a);
  });

  it('does not mutate its input', () => {
    const copy = structuredClone(FIXTURE);
    buildExerciseSeedSql(copy);
    expect(copy).toEqual(FIXTURE);
  });

  it('changes when the input changes', () => {
    const changed = structuredClone(FIXTURE);
    changed[1].content = 'Un tout autre sujet pour cette ligne.';
    expect(buildExerciseSeedSql(changed)).not.toBe(buildExerciseSeedSql(FIXTURE));
  });

  it('escapes single quotes by doubling them', () => {
    const out = buildExerciseSeedSql(FIXTURE);
    expect(out).toContain("'C''est l''''avis d''un ami");
    expect(out).toContain("l''avis-d''un-ami");
  });
});

// PGlite applies every migration (including the real exercise data) once for this block.
describe('buildExerciseSeedSql (on PGlite)', { timeout: 60_000 }, () => {
  let testDb;
  let userId;

  beforeAll(async () => {
    testDb = await createTestDb();
  }, 120_000);
  afterAll(() => testDb.close());
  beforeEach(async () => {
    await testDb.truncateAll();
    userId = await testDb.createUser();
  }, 60_000);

  const expectFixtureState = (snap) => {
    expect(snap.sessions).toEqual([
      { year: 2025, month: 11, sourceUrl: URL_NOV, fetchedAt: null },
      { year: 2025, month: 12, sourceUrl: URL_DEC_A, fetchedAt: null },
    ]);

    const byId = new Map(snap.exercises.map((e) => [e.id, e]));
    expect(byId.get(CANON_VOISIN)).toMatchObject({
      task: 2,
      prompt: VOISIN_NORMALIZED,
      contentHash: contentHash(VOISIN_NBSP),
      sourceUrl: URL_NOV,
      imageUrl: null,
      isImageBased: false,
      firstSeenOn: '2025-11-01',
      lastSeenOn: '2025-12-01',
    });
    expect(byId.get(ESCAPE_ID)).toMatchObject({
      task: 2,
      prompt: normalizeSubjectText(ESCAPE_TEXT),
      contentHash: contentHash(ESCAPE_TEXT),
      sourceUrl: URL_DEC_B,
      imageUrl: null,
      isImageBased: false,
      firstSeenOn: '2025-12-01',
      lastSeenOn: '2025-12-01',
    });
    expect(byId.get(ESCAPE_ID).prompt).toBe(
      "C'est l''avis d'un ami « très » important ; -- pas un commentaire \\ $$ fin."
    );
    expect(byId.get(T3_ID)).toMatchObject({
      task: 3,
      prompt: VOISIN_NORMALIZED,
      contentHash: contentHash(VOISIN_CURLY),
      sourceUrl: URL_DEC_A,
      imageUrl: 'https://img.test/t3.png',
      isImageBased: true,
      firstSeenOn: '2025-12-01',
      lastSeenOn: '2025-12-01',
    });
    expect(byId.get('t1-entretien')).toMatchObject({
      task: 1,
      prompt: T1_PROMPT,
      contentHash: contentHash(T1_PROMPT),
    });
    expect(byId.has(ALIAS_VOISIN)).toBe(false);
    for (const e of snap.exercises) expect(e.contentHash, e.id).not.toBeNull();

    expect(snap.aliases).toEqual([{ aliasId: ALIAS_VOISIN, exerciseId: CANON_VOISIN }]);

    expect(snap.occurrences.map(({ sessionId: _id, ...o }) => o)).toEqual([
      {
        sourceRef: '2025-11-t2-p002-s001',
        exerciseId: CANON_VOISIN,
        task: 2,
        part: 2,
        position: 1,
        session: '2025-11',
      },
      {
        sourceRef: '2025-12-t2-p001-s001',
        exerciseId: ESCAPE_ID,
        task: 2,
        part: 1,
        position: 1,
        session: '2025-12',
      },
      {
        sourceRef: '2025-12-t2-p001-s002',
        exerciseId: CANON_VOISIN,
        task: 2,
        part: 1,
        position: 2,
        session: '2025-12',
      },
      {
        sourceRef: '2025-12-t3-p001-s001',
        exerciseId: T3_ID,
        task: 3,
        part: 1,
        position: 1,
        session: '2025-12',
      },
    ]);
  };

  it('fills an empty bank', async () => {
    await runSql(testDb.db, buildExerciseSeedSql(FIXTURE));
    const snap = await snapshot(testDb.db);
    expectFixtureState(snap);
    expect(snap.exercises.map((e) => e.id)).toEqual([
      CANON_VOISIN,
      ESCAPE_ID,
      T3_ID,
      't1-entretien',
    ]);
  });

  it('gives the same state when executed twice on an empty bank', async () => {
    const text = buildExerciseSeedSql(FIXTURE);
    await runSql(testDb.db, text);
    const once = await snapshot(testDb.db);
    await runSql(testDb.db, text);
    const twice = await snapshot(testDb.db);
    expect(twice).toEqual(once);
    expectFixtureState(twice);
  });

  it('upgrades a bank pre-filled by the legacy seed and repoints attempts', async () => {
    await insertLegacyBank(testDb.db);
    const onAlias = await insertAttempt(
      testDb,
      userId,
      ALIAS_VOISIN,
      new Date('2025-01-01T00:00:00Z')
    );
    const onT3 = await insertAttempt(testDb, userId, T3_ID, new Date('2025-01-02T00:00:00Z'));
    const onOrphan = await insertAttempt(
      testDb,
      userId,
      'legacy-orphan',
      new Date('2025-01-03T00:00:00Z')
    );
    const onNothing = await insertAttempt(testDb, userId, null, new Date('2025-01-04T00:00:00Z'));

    await runSql(testDb.db, buildExerciseSeedSql(FIXTURE));
    const snap = await snapshot(testDb.db);
    expectFixtureState(snap);

    expect(snap.attempts).toEqual([
      { id: onAlias, exerciseId: CANON_VOISIN },
      { id: onT3, exerciseId: T3_ID },
      { id: onOrphan, exerciseId: 'legacy-orphan' },
      { id: onNothing, exerciseId: null },
    ]);

    const byId = new Map(snap.exercises.map((e) => [e.id, e]));
    // Legacy prompt replaced by the normalized CSV text; untouched columns kept.
    expect(byId.get(ESCAPE_ID).prompt).toBe(normalizeSubjectText(ESCAPE_TEXT));
    expect(byId.get(ESCAPE_ID).theme).toBe('avis');
    // A legacy row that the CSV no longer has gets a placeholder hash.
    expect(byId.get('legacy-orphan')).toMatchObject({
      task: 2,
      prompt: 'Sujet absent du CSV.',
      contentHash: 'legacy:legacy-orphan',
    });
    expect(snap.exercises.map((e) => e.id)).toEqual([
      CANON_VOISIN,
      ESCAPE_ID,
      T3_ID,
      'legacy-orphan',
      't1-entretien',
    ]);
  });

  it('gives the same state when executed twice on a legacy bank', async () => {
    await insertLegacyBank(testDb.db);
    await insertAttempt(testDb, userId, ALIAS_VOISIN, new Date('2025-01-01T00:00:00Z'));
    const text = buildExerciseSeedSql(FIXTURE);
    await runSql(testDb.db, text);
    const once = await snapshot(testDb.db);
    await runSql(testDb.db, text);
    const twice = await snapshot(testDb.db);
    expect(twice).toEqual(once);
    expect(twice.attempts.map((a) => a.exerciseId)).toEqual([CANON_VOISIN]);
  });

  it('keeps the first row when an id is repeated', async () => {
    await runSql(testDb.db, buildExerciseSeedSql(FIXTURE));
    const snap = await snapshot(testDb.db);
    expect(snap.exercises.some((e) => e.prompt.includes('Doublon'))).toBe(false);
  });

  it('skips every invalid row', async () => {
    await runSql(testDb.db, buildExerciseSeedSql(FIXTURE));
    const snap = await snapshot(testDb.db);
    expect(snap.exercises).toHaveLength(4);
    expect(snap.occurrences).toHaveLength(4);
    expect(snap.sessions).toHaveLength(2);
    for (const text of [
      'Identifiant invalide.',
      'Mois invalide.',
      'Tâche non gérée par la banque.',
      'Type de tâche inconnu.',
    ]) {
      expect(snap.exercises.some((e) => e.prompt === text)).toBe(false);
    }
  });

  it('produces only the tâche 1 row for an input without valid rows', async () => {
    await runSql(
      testDb.db,
      buildExerciseSeedSql([row('bad', 'Tâche 2', 'Texte quelconque.', URL_NOV)])
    );
    const snap = await snapshot(testDb.db);
    expect(snap.exercises.map((e) => e.id)).toEqual(['t1-entretien']);
    expect(snap.sessions).toEqual([]);
    expect(snap.aliases).toEqual([]);
    expect(snap.occurrences).toEqual([]);
  });

  it('canonicalizes on the smallest id, not on input order, within one month', async () => {
    const rows = [
      row('2025-05-t3-p002-s003', 'Tâche 3', 'Faut-il interdire les voitures en ville ?', URL_NOV),
      row(
        '2025-05-t3-p001-s009',
        'Tâche 3',
        'Faut-il  interdire les voitures en ville ?',
        URL_DEC_A,
        'https://img.test/a.png',
        'TRUE'
      ),
      row(
        '2025-05-t3-p010-s001',
        'Tâche 3',
        'Faut-il interdire les voitures en ville ?',
        URL_DEC_B
      ),
    ];
    await runSql(testDb.db, buildExerciseSeedSql(rows));
    const snap = await snapshot(testDb.db);
    expect(snap.exercises.map((e) => e.id)).toEqual(['2025-05-t3-p001-s009', 't1-entretien']);
    expect(snap.exercises[0]).toMatchObject({
      prompt: 'Faut-il interdire les voitures en ville ?',
      sourceUrl: URL_DEC_A,
      imageUrl: 'https://img.test/a.png',
      isImageBased: true,
      firstSeenOn: '2025-05-01',
      lastSeenOn: '2025-05-01',
    });
    expect(snap.aliases).toEqual([
      { aliasId: '2025-05-t3-p002-s003', exerciseId: '2025-05-t3-p001-s009' },
      { aliasId: '2025-05-t3-p010-s001', exerciseId: '2025-05-t3-p001-s009' },
    ]);
    // The session URL is the first row of the month in input order.
    expect(snap.sessions).toEqual([{ year: 2025, month: 5, sourceUrl: URL_NOV, fetchedAt: null }]);
  });

  it('spans first/last seen over every month of a group', async () => {
    const text = "Vous voulez adopter un chien. Je suis employé d'un refuge.";
    const rows = [
      row('2024-06-t2-p001-s001', 'Tâche 2', text, URL_NOV),
      row('2023-02-t2-p003-s002', 'Tâche 2', text, URL_NOV),
      row('2025-01-t2-p002-s004', 'Tâche 2', text, URL_NOV),
    ];
    await runSql(testDb.db, buildExerciseSeedSql(rows));
    const snap = await snapshot(testDb.db);
    expect(snap.exercises[0]).toMatchObject({
      id: '2023-02-t2-p003-s002',
      firstSeenOn: '2023-02-01',
      lastSeenOn: '2025-01-01',
    });
    expect(snap.sessions.map((s) => [s.year, s.month])).toEqual([
      [2023, 2],
      [2024, 6],
      [2025, 1],
    ]);
    expect(snap.occurrences.map((o) => o.exerciseId)).toEqual([
      '2023-02-t2-p003-s002',
      '2023-02-t2-p003-s002',
      '2023-02-t2-p003-s002',
    ]);
  });

  it('handles a large input (several insert statements)', async () => {
    const rows = [];
    for (let i = 1; i <= 1500; i++) {
      const task = i % 2 === 0 ? 2 : 3;
      const month = (i % 12) + 1;
      const part = Math.floor(i / 12) + 1;
      rows.push(
        row(
          `2024-${String(month).padStart(2, '0')}-t${task}-p${String(part).padStart(3, '0')}-s001`,
          `Tâche ${task}`,
          `Sujet numéro ${i} : parlez-moi de l'endroit où vous vivez.`,
          URL_NOV
        )
      );
    }
    await runSql(testDb.db, buildExerciseSeedSql(rows));
    const snap = await snapshot(testDb.db);
    expect(snap.exercises).toHaveLength(1501);
    expect(snap.occurrences).toHaveLength(1500);
    expect(snap.aliases).toHaveLength(0);
    expect(snap.sessions).toHaveLength(12);
  });
});
