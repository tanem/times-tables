import { describe, expect, it } from 'vitest';
import { grade, weightOf, type Level, type Outcome } from './level';

describe('grade', () => {
  const transitions: ReadonlyArray<readonly [Level, Outcome, Level]> = [
    [0, 'fast', 1],
    [3, 'fast', 4],
    [4, 'fast', 4],
    [4, 'slow', 3],
    [1, 'slow', 0],
    [0, 'slow', 0],
    [4, 'missed', 0],
    [1, 'missed', 0],
    [0, 'missed', 0],
  ];

  for (const [from, outcome, to] of transitions) {
    it(`moves level ${from} to ${to} on ${outcome}`, () => {
      expect(grade(from, outcome)).toBe(to);
    });
  }
});

describe('weightOf', () => {
  it('weights the levels 8, 4, 2, 1 and 1', () => {
    expect([0, 1, 2, 3, 4].map((level) => weightOf(level as Level))).toEqual([
      8, 4, 2, 1, 1,
    ]);
  });
});
