import { describe, expect, it } from 'vitest';
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
