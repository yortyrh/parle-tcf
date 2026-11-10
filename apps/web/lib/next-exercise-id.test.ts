import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  nextExerciseIdRandom,
  nextExerciseIdSequential,
  previousExerciseIdSequential,
} from './next-exercise-id';

describe('nextExerciseIdSequential', () => {
  it('wraps after last id', () => {
    expect(nextExerciseIdSequential(['a', 'b', 'c'], 'b')).toBe('c');
    expect(nextExerciseIdSequential(['a', 'b', 'c'], 'c')).toBe('a');
  });

  it('starts at first when current unknown', () => {
    expect(nextExerciseIdSequential(['x', 'y'], 'unknown')).toBe('x');
  });
});

describe('previousExerciseIdSequential', () => {
  it('wraps before first id', () => {
    expect(previousExerciseIdSequential(['a', 'b', 'c'], 'b')).toBe('a');
    expect(previousExerciseIdSequential(['a', 'b', 'c'], 'a')).toBe('c');
  });

  it('starts at last when current unknown', () => {
    expect(previousExerciseIdSequential(['x', 'y'], 'unknown')).toBe('y');
  });
});

describe('nextExerciseIdRandom', () => {
  it('returns an id from the list', () => {
    const ids = ['p', 'q', 'r'];
    const v = nextExerciseIdRandom(ids, 'p');
    expect(ids).toContain(v);
  });

  it('avoids current when more than one id', () => {
    const ids = ['only-a', 'only-b'];
    for (let i = 0; i < 20; i++) {
      expect(nextExerciseIdRandom(ids, 'only-a')).toBe('only-b');
    }
  });
});

describe('edge cases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('every picker rejects an empty list', () => {
    expect(() => nextExerciseIdSequential([], 'a')).toThrow('orderedIds must be non-empty');
    expect(() => previousExerciseIdSequential([], 'a')).toThrow('orderedIds must be non-empty');
    expect(() => nextExerciseIdRandom([], 'a')).toThrow('orderedIds must be non-empty');
  });

  it('starts at the first or last id without a current id', () => {
    expect(nextExerciseIdSequential(['x', 'y'], undefined)).toBe('x');
    expect(previousExerciseIdSequential(['x', 'y'], undefined)).toBe('y');
  });

  it('returns the only id of a single-subject list', () => {
    expect(nextExerciseIdSequential(['solo'], 'solo')).toBe('solo');
    expect(previousExerciseIdSequential(['solo'], 'solo')).toBe('solo');
    expect(nextExerciseIdRandom(['solo'], 'solo')).toBe('solo');
  });

  it('picks among every id without a current id', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(nextExerciseIdRandom(['a', 'b', 'c'], undefined)).toBe('c');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(nextExerciseIdRandom(['a', 'b', 'c'], undefined)).toBe('a');
  });

  it('falls back to the first id when every id equals the current one', () => {
    expect(nextExerciseIdRandom(['a', 'a'], 'a')).toBe('a');
  });
});
