import { describe, expect, it } from 'vitest';
import {
  addToSplit,
  pruneSplits,
  splitGroupOf,
} from '@core/features/terminals/api/browser/task-terminal/terminal-splits';

describe('terminal splits', () => {
  it('creates a group when the anchor is unsplit', () => {
    expect(addToSplit(undefined, 'a', 'b')).toEqual([['a', 'b']]);
  });

  it('inserts right after the anchor in an existing group', () => {
    expect(addToSplit([['a', 'c']], 'a', 'b')).toEqual([['a', 'b', 'c']]);
  });

  it('joins a terminal from another group, dropping the leftover singleton', () => {
    expect(
      addToSplit(
        [
          ['a', 'b'],
          ['c', 'd'],
        ],
        'a',
        'c'
      )
    ).toEqual([['a', 'c', 'b']]);
  });

  it('returns the containing group, or the id alone', () => {
    expect(splitGroupOf([['a', 'b']], 'b')).toEqual(['a', 'b']);
    expect(splitGroupOf([['a', 'b']], 'z')).toEqual(['z']);
  });

  it('drops dead ids and groups left with one member', () => {
    expect(
      pruneSplits(
        [
          ['a', 'b', 'c'],
          ['d', 'e'],
        ],
        new Set(['a', 'c', 'd'])
      )
    ).toEqual([['a', 'c']]);
  });
});
