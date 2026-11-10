import { describe, expect, it } from 'vitest';
import { routeToNames, toNames } from './scaffold-names.mjs';

describe('toNames', () => {
  it('derives camel and pascal names from a multi-word kebab name', () => {
    expect(toNames('exercise-bank')).toEqual({
      kebab: 'exercise-bank',
      camel: 'exerciseBank',
      pascal: 'ExerciseBank',
    });
  });

  it('handles a single-word name', () => {
    expect(toNames('usage')).toEqual({
      kebab: 'usage',
      camel: 'usage',
      pascal: 'Usage',
    });
  });

  it('keeps digits and capitalises digit-led segments as-is', () => {
    expect(toNames('tache2-v2')).toEqual({
      kebab: 'tache2-v2',
      camel: 'tache2V2',
      pascal: 'Tache2V2',
    });
  });

  it('handles three segments and single-letter segments', () => {
    expect(toNames('a-b-c')).toEqual({
      kebab: 'a-b-c',
      camel: 'aBC',
      pascal: 'ABC',
    });
    expect(toNames('x')).toEqual({ kebab: 'x', camel: 'x', pascal: 'X' });
  });

  it('accepts a segment that starts with a digit after the first one', () => {
    expect(toNames('tache-2')).toEqual({
      kebab: 'tache-2',
      camel: 'tache2',
      pascal: 'Tache2',
    });
  });

  it('returns exactly the kebab, camel and pascal keys', () => {
    expect(Object.keys(toNames('exercise-bank')).sort()).toEqual(['camel', 'kebab', 'pascal']);
  });

  it.each([
    '',
    'Foo',
    'foo_bar',
    'foo--bar',
    '-foo',
    'foo-',
    '2foo',
    'foo bar',
    'fooBar',
    'foo-Bar',
    'foo/bar',
    'foo.bar',
    ' foo',
    'foo ',
    'foo\n',
    'é',
  ])('rejects %j with an Error naming the input', (input) => {
    expect(() => toNames(input)).toThrow(Error);
    if (input.trim() !== '') {
      expect(() => toNames(input)).toThrow(input.trim());
    }
  });

  it('includes the full invalid input in the error message', () => {
    expect(() => toNames('foo_bar')).toThrow('foo_bar');
    expect(() => toNames('Exercise-Bank')).toThrow('Exercise-Bank');
  });
});

describe('routeToNames', () => {
  it('strips leading and trailing slashes and joins the segments', () => {
    expect(routeToNames('/sujets/du-mois/')).toEqual({
      route: 'sujets/du-mois',
      segments: ['sujets', 'du-mois'],
      kebab: 'sujets-du-mois',
      camel: 'sujetsDuMois',
      pascal: 'SujetsDuMois',
    });
  });

  it('accepts a route without surrounding slashes', () => {
    expect(routeToNames('sujets/du-mois')).toEqual({
      route: 'sujets/du-mois',
      segments: ['sujets', 'du-mois'],
      kebab: 'sujets-du-mois',
      camel: 'sujetsDuMois',
      pascal: 'SujetsDuMois',
    });
  });

  it('accepts a leading slash only or a trailing slash only', () => {
    expect(routeToNames('/historique').route).toBe('historique');
    expect(routeToNames('historique/').route).toBe('historique');
  });

  it('handles a single-segment route', () => {
    expect(routeToNames('historique')).toEqual({
      route: 'historique',
      segments: ['historique'],
      kebab: 'historique',
      camel: 'historique',
      pascal: 'Historique',
    });
  });

  it('handles three segments', () => {
    expect(routeToNames('/a/b-c/d2')).toEqual({
      route: 'a/b-c/d2',
      segments: ['a', 'b-c', 'd2'],
      kebab: 'a-b-c-d2',
      camel: 'aBCD2',
      pascal: 'ABCD2',
    });
  });

  it.each(['Sujets', 'a//b', '[id]', 'sujets/Du-mois', 'sujets/du_mois'])(
    'rejects the invalid route %j',
    (route) => {
      expect(() => routeToNames(route)).toThrow(Error);
    }
  );

  it.each(['', '/', '//'])('rejects the empty route %j', (route) => {
    expect(() => routeToNames(route)).toThrow(Error);
  });
});
