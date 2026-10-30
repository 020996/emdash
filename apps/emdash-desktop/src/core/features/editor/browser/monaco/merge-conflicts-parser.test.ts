import { describe, expect, it } from 'vitest';
import { findConflicts, resolveConflict } from './merge-conflicts-parser';

const lines = [
  'keep',
  '<<<<<<< HEAD',
  'mine',
  '||||||| base',
  'old',
  '=======',
  'theirs',
  '>>>>>>> topic',
  '<<<<<<< HEAD',
  '=======',
  'only theirs',
  '>>>>>>> topic',
];

describe('merge conflicts parser', () => {
  it('finds plain and diff3 conflict blocks', () => {
    expect(findConflicts(lines)).toEqual([
      { start: 1, base: 3, separator: 5, end: 7 },
      { start: 8, separator: 9, end: 11 },
    ]);
  });

  it('ignores unterminated markers', () => {
    expect(findConflicts(['<<<<<<< HEAD', 'a', '======='])).toEqual([]);
  });

  it('resolves current, incoming, and both (base dropped)', () => {
    const [diff3, plain] = findConflicts(lines);
    expect(resolveConflict(lines, diff3!, 'current')).toEqual(['mine']);
    expect(resolveConflict(lines, diff3!, 'incoming')).toEqual(['theirs']);
    expect(resolveConflict(lines, diff3!, 'both')).toEqual(['mine', 'theirs']);
    expect(resolveConflict(lines, plain!, 'current')).toEqual([]);
  });
});
