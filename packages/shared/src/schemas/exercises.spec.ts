import { describe, expect, it } from 'vitest';
import {
  exerciseListItemSchema,
  exerciseSessionSchema,
  featuredExercisesOutputSchema,
  listExerciseSessionsOutputSchema,
  listExercisesInputSchema,
  listExercisesOutputSchema,
} from './exercises';

const item = {
  id: 't2-a',
  task: 2,
  prompt: 'Je suis votre voisin.',
  firstSeenOn: '2025-12-01',
  lastSeenOn: null,
  timesPublished: 2,
  isImageBased: false,
};
const session = { id: 7, year: 2025, month: 12, tache2: 4, tache3: 2 };

describe('listExercisesInputSchema', () => {
  it('defaults to the first 20 subjects', () => {
    expect(listExercisesInputSchema.parse({ task: 2 })).toEqual({ task: 2, limit: 20, offset: 0 });
  });

  it('only lists tasks 2 and 3', () => {
    expect(listExercisesInputSchema.parse({ task: 3 }).task).toBe(3);
    expect(listExercisesInputSchema.safeParse({ task: 1 }).success).toBe(false);
    expect(listExercisesInputSchema.safeParse({ task: 4 }).success).toBe(false);
    expect(listExercisesInputSchema.safeParse({ task: '2' }).success).toBe(false);
    expect(listExercisesInputSchema.safeParse({}).success).toBe(false);
  });

  it('bounds limit to 1..100 and offset to >= 0', () => {
    const parse = (extra: object) => listExercisesInputSchema.safeParse({ task: 2, ...extra });
    expect(parse({ limit: 0 }).success).toBe(false);
    expect(parse({ limit: 1 }).success).toBe(true);
    expect(parse({ limit: 100 }).success).toBe(true);
    expect(parse({ limit: 101 }).success).toBe(false);
    expect(parse({ offset: 0 }).success).toBe(true);
    expect(parse({ offset: -1 }).success).toBe(false);
  });

  it('requires a positive integer session id', () => {
    const parse = (sessionId: number) =>
      listExercisesInputSchema.safeParse({ task: 2, sessionId }).success;
    expect(parse(1)).toBe(true);
    expect(parse(0)).toBe(false);
    expect(parse(-3)).toBe(false);
    expect(parse(1.5)).toBe(false);
  });

  it('trims the search and caps it at 100 characters', () => {
    expect(listExercisesInputSchema.parse({ task: 2, search: '  école  ' }).search).toBe('école');
    expect(listExercisesInputSchema.safeParse({ task: 2, search: 'a'.repeat(100) }).success).toBe(
      true
    );
    expect(listExercisesInputSchema.safeParse({ task: 2, search: 'a'.repeat(101) }).success).toBe(
      false
    );
    // Trimming happens before the cap.
    expect(
      listExercisesInputSchema.safeParse({ task: 2, search: ` ${'a'.repeat(100)} ` }).success
    ).toBe(true);
  });
});

describe('exercise outputs', () => {
  it('accepts a list item with nullable dates', () => {
    expect(exerciseListItemSchema.parse(item)).toEqual(item);
    expect(exerciseListItemSchema.safeParse({ ...item, timesPublished: 1.5 }).success).toBe(false);
    expect(exerciseListItemSchema.safeParse({ ...item, isImageBased: 'no' }).success).toBe(false);
  });

  it('bounds the session month to 1..12', () => {
    expect(exerciseSessionSchema.parse(session)).toEqual(session);
    expect(exerciseSessionSchema.safeParse({ ...session, month: 0 }).success).toBe(false);
    expect(exerciseSessionSchema.safeParse({ ...session, month: 1 }).success).toBe(true);
    expect(exerciseSessionSchema.safeParse({ ...session, month: 13 }).success).toBe(false);
  });

  it('wraps items and sessions', () => {
    expect(listExercisesOutputSchema.parse({ items: [item], total: 1 })).toEqual({
      items: [item],
      total: 1,
    });
    expect(listExerciseSessionsOutputSchema.parse({ sessions: [session] })).toEqual({
      sessions: [session],
    });
    expect(listExerciseSessionsOutputSchema.safeParse({ sessions: [{ id: 1 }] }).success).toBe(
      false
    );
  });

  it('allows a featured teaser without a session (empty bank)', () => {
    expect(featuredExercisesOutputSchema.parse({ session: null, items: [] })).toEqual({
      session: null,
      items: [],
    });
    expect(featuredExercisesOutputSchema.parse({ session, items: [item] })).toEqual({
      session,
      items: [item],
    });
    expect(featuredExercisesOutputSchema.safeParse({ items: [] }).success).toBe(false);
  });
});
