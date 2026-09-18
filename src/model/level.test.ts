import { describe, expect, it } from 'vitest';
import {
  grade,
  timedOutcome,
  weightOf,
  type Level,
  type Outcome,
} from './level';

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

describe('timedOutcome', () => {
  it('grades an answer got inside 3 seconds as fast', () => {
    expect(timedOutcome(true, 0)).toBe('fast');
    expect(timedOutcome(true, 2999)).toBe('fast');
  });

  it('grades an answer got at 3 seconds or later as slow', () => {
    expect(timedOutcome(true, 3000)).toBe('slow');
    expect(timedOutcome(true, 60000)).toBe('slow');
  });

  it('grades an answer not got as missed, however quick', () => {
    expect(timedOutcome(false, 0)).toBe('missed');
    expect(timedOutcome(false, 5000)).toBe('missed');
  });
});
