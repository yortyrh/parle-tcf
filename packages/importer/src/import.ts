import {
  contentHash,
  type Database,
  exerciseIdFor,
  exerciseOccurrences,
  exercises,
  exerciseSessions,
  sessionDate,
  sourceRef,
  sql,
} from "@parle-tcf/db";
import type { ParsedSubject } from "./parse";

export interface SessionInput {
  year: number;
  month: number;
  sourceUrl: string;
}

export interface SessionImportResult {
  inserted: number;
  updated: number;
  occurrences: number;
}

/**
 * Upserts one month: the session, one exercise per distinct subject (deduplicated on
 * task + content hash, so republished subjects reuse the existing row) and one
 * occurrence per published position. Runs in a single transaction.
 */
export async function importSession(
  db: Database,
  { year, month, sourceUrl }: SessionInput,
  subjects: ParsedSubject[],
  { now = new Date() }: { now?: Date } = {},
): Promise<SessionImportResult> {
  const seenOn = sessionDate(year, month);
  return db.transaction(async (tx) => {
    const [session] = await tx
      .insert(exerciseSessions)
      .values({ year, month, sourceUrl, fetchedAt: now })
      .onConflictDoUpdate({
        target: [exerciseSessions.year, exerciseSessions.month],
        set: { sourceUrl, fetchedAt: now },
      })
      .returning({ id: exerciseSessions.id });

    const inserted = new Set<string>();
    const matched = new Set<string>();
    for (const subject of subjects) {
      const hash = contentHash(subject.text);
      const [row] = await tx
        .insert(exercises)
        .values({
          id: exerciseIdFor(subject.task, hash),
          task: subject.task,
          prompt: subject.text,
          contentHash: hash,
          contentHtml: subject.html,
          scenario: subject.scenario,
          instruction: subject.instruction,
          sourceUrl,
          firstSeenOn: seenOn,
          lastSeenOn: seenOn,
        })
        .onConflictDoUpdate({
          target: [exercises.task, exercises.contentHash],
          set: {
            firstSeenOn: sql`least(${exercises.firstSeenOn}, excluded.first_seen_on)`,
            lastSeenOn: sql`greatest(${exercises.lastSeenOn}, excluded.last_seen_on)`,
            contentHtml: sql`coalesce(${exercises.contentHtml}, excluded.content_html)`,
            scenario: sql`coalesce(${exercises.scenario}, excluded.scenario)`,
            instruction: sql`coalesce(${exercises.instruction}, excluded.instruction)`,
          },
        })
        .returning({ id: exercises.id, created: sql<boolean>`(xmax = 0)` });

      if (row.created && !matched.has(row.id)) inserted.add(row.id);
      else if (!inserted.has(row.id)) matched.add(row.id);

      const ref = sourceRef({
        year,
        month,
        task: subject.task,
        part: subject.part,
        position: subject.position,
      });
      await tx
        .insert(exerciseOccurrences)
        .values({
          sourceRef: ref,
          exerciseId: row.id,
          sessionId: session.id,
          task: subject.task,
          part: subject.part,
          position: subject.position,
        })
        .onConflictDoUpdate({
          target: exerciseOccurrences.sourceRef,
          set: { exerciseId: row.id, sessionId: session.id },
        });
    }
    return {
      inserted: inserted.size,
      updated: matched.size,
      occurrences: subjects.length,
    };
  });
}
