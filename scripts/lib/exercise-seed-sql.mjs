/**
 * Builds exercise-bank SQL (the public sample bank, or the real bank kept in the private
 * repository yortyrh/parle-tcf-data) from a CSV export. Pure: CSV records in, SQL text out.
 * Regenerate with `pnpm exercises:seed-sql` (scripts/exercises-csv-to-sql.mjs).
 *
 * Subjects republished in several months collapse into one exercise (smallest id
 * wins); the other ids become aliases, attempts pointing at them are moved, and
 * every published position is kept as an occurrence. Safe on an empty bank, on a
 * bank filled by the old CSV seed, and when run twice.
 */
import {
  TACHE1_ENTRETIEN_ID,
  contentHash,
  normalizeSubjectText,
  parseSourceRef,
  sessionDate,
} from '@parle-tcf/db';

const BREAKPOINT = '\n--> statement-breakpoint\n';
const BATCH = 500;
const TASKS = { 'Tâche 2': 2, 'Tâche 3': 3 };
const TACHE1_PROMPT =
  'Entretien dirigé : présentation de soi, puis questions sur des sujets quotidiens.';

/** @param {string | number | boolean | null} value */
function lit(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Multi-row INSERT statements of at most BATCH rows. */
function inserts(head, tuples, tail) {
  const out = [];
  for (let i = 0; i < tuples.length; i += BATCH) {
    out.push(`${head}\n${tuples.slice(i, i + BATCH).join(',\n')}\n${tail};`);
  }
  return out;
}

/**
 * @param {{ id: string, taskType: string, content: string, url: string, imageUrl?: string, isImageBased?: string }[]} rows
 * @returns {string}
 */
export function buildExerciseSeedSql(rows) {
  /** @type {Map<string, any>} */
  const byId = new Map();
  for (const row of rows) {
    if (byId.has(row.id)) continue;
    const task = TASKS[row.taskType];
    const ref = parseSourceRef(row.id);
    const prompt = normalizeSubjectText(row.content ?? '');
    if (!task || !ref || ref.task !== task || prompt === '') continue;
    byId.set(row.id, {
      ...row,
      task,
      ref,
      prompt,
      hash: contentHash(row.content),
    });
  }
  const valid = [...byId.values()];

  // Sessions: first url of each month in input order.
  /** @type {Map<string, { year: number, month: number, url: string }>} */
  const sessions = new Map();
  for (const r of valid) {
    const key = `${r.ref.year}-${r.ref.month}`;
    if (!sessions.has(key)) sessions.set(key, { year: r.ref.year, month: r.ref.month, url: r.url });
  }
  const sessionList = [...sessions.values()].sort((a, b) => a.year - b.year || a.month - b.month);

  // Groups of identical subjects; canonical = smallest id.
  /** @type {Map<string, any[]>} */
  const groups = new Map();
  for (const r of valid) {
    const key = `${r.task}|${r.hash}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const exercises = [];
  const aliases = [];
  /** @type {Map<string, string>} */
  const canonicalOf = new Map();
  for (const members of groups.values()) {
    members.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const canonical = members[0];
    const dates = members.map((m) => sessionDate(m.ref.year, m.ref.month)).sort();
    exercises.push({
      ...canonical,
      firstSeen: dates[0],
      lastSeen: dates[dates.length - 1],
    });
    for (const m of members) {
      canonicalOf.set(m.id, canonical.id);
      if (m.id !== canonical.id) aliases.push({ alias: m.id, target: canonical.id });
    }
  }
  exercises.sort((a, b) => (a.id < b.id ? -1 : 1));
  aliases.sort((a, b) => (a.alias < b.alias ? -1 : 1));
  const occurrences = [...valid].sort((a, b) => (a.id < b.id ? -1 : 1));

  const statements = [
    ...inserts(
      'INSERT INTO "exercise_sessions" ("year", "month", "source_url") VALUES',
      sessionList.map((s) => `(${lit(s.year)}, ${lit(s.month)}, ${lit(s.url || null)})`),
      'ON CONFLICT ("year", "month") DO UPDATE SET "source_url" = EXCLUDED."source_url"'
    ),
    ...inserts(
      'INSERT INTO "exercises" ("id", "task", "prompt", "content_hash", "source_url", "image_url", "is_image_based", "first_seen_on", "last_seen_on") VALUES',
      exercises.map(
        (e) =>
          `(${lit(e.id)}, ${lit(e.task)}, ${lit(e.prompt)}, ${lit(e.hash)}, ${lit(e.url || null)}, ${lit(e.imageUrl || null)}, ${lit(e.isImageBased === 'TRUE')}, ${lit(e.firstSeen)}, ${lit(e.lastSeen)})`
      ),
      'ON CONFLICT ("id") DO UPDATE SET "task" = EXCLUDED."task", "prompt" = EXCLUDED."prompt", "content_hash" = EXCLUDED."content_hash", "source_url" = EXCLUDED."source_url", "image_url" = EXCLUDED."image_url", "is_image_based" = EXCLUDED."is_image_based", "first_seen_on" = EXCLUDED."first_seen_on", "last_seen_on" = EXCLUDED."last_seen_on"'
    ),
    ...inserts(
      'INSERT INTO "exercise_aliases" ("alias_id", "exercise_id") VALUES',
      aliases.map((a) => `(${lit(a.alias)}, ${lit(a.target)})`),
      'ON CONFLICT ("alias_id") DO UPDATE SET "exercise_id" = EXCLUDED."exercise_id"'
    ),
    'UPDATE "exam_attempts" SET "exercise_id" = a."exercise_id" FROM "exercise_aliases" a WHERE "exam_attempts"."exercise_id" = a."alias_id";',
    'DELETE FROM "exercises" WHERE "id" IN (SELECT "alias_id" FROM "exercise_aliases");',
    ...inserts(
      'INSERT INTO "exercise_occurrences" ("source_ref", "exercise_id", "session_id", "task", "part", "position")\nSELECT v."source_ref", v."exercise_id", s."id", v."task", v."part", v."position" FROM (VALUES',
      occurrences.map(
        (o) =>
          `(${lit(o.id)}, ${lit(canonicalOf.get(o.id))}, ${o.ref.year}::smallint, ${o.ref.month}::smallint, ${o.task}::smallint, ${o.ref.part}::smallint, ${o.ref.position}::smallint)`
      ),
      ') AS v("source_ref", "exercise_id", "year", "month", "task", "part", "position")\nJOIN "exercise_sessions" s ON s."year" = v."year" AND s."month" = v."month"\nON CONFLICT ("source_ref") DO UPDATE SET "exercise_id" = EXCLUDED."exercise_id", "session_id" = EXCLUDED."session_id"'
    ),
    `INSERT INTO "exercises" ("id", "task", "prompt", "content_hash") VALUES (${lit(TACHE1_ENTRETIEN_ID)}, 1, ${lit(TACHE1_PROMPT)}, ${lit(contentHash(TACHE1_PROMPT))})\nON CONFLICT ("id") DO UPDATE SET "content_hash" = EXCLUDED."content_hash";`,
    `UPDATE "exercises" SET "content_hash" = 'legacy:' || "id" WHERE "content_hash" IS NULL;`,
  ];

  return `-- Generated by scripts/exercises-csv-to-sql.mjs from apps/api/config/tcf-exercises.csv. Do not edit.\n${statements.join(BREAKPOINT)}\n`;
}
