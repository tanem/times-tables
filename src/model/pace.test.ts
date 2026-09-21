import { describe, expect, it } from 'vitest';
import {
  PACE_NEEDED,
  TIME_CAP,
  TIMES_KEPT,
  answerTime,
  gradeAnswer,
  keepTime,
  medianTime,
  paceOf,
} from './pace';

// The given number of answer times, each 1000 ms apart from the one before,
// starting at 1000.
function times(count: number): number[] {
  return Array.from({ length: count }, (_, index) => 1000 * (index + 1));
}

describe('medianTime', () => {
  it('has no median with no answer times', () => {
    expect(medianTime([])).toBeNull();
  });

  it('is the middle time of an odd count', () => {
    expect(medianTime([3000, 1000, 2000])).toBe(2000);
  });

  it('is the midpoint of the two middle times of an even count', () => {
    expect(medianTime([1000, 2000, 3000, 5000])).toBe(2500);
  });

  it('rounds a midpoint that falls on a half to the nearest whole millisecond', () => {
    expect(medianTime([1000, 1001])).toBe(1001);
  });
});

describe('paceOf', () => {
  it('needs 20 answer times', () => {
    expect(PACE_NEEDED).toBe(20);
  });

  it('has no pace below 20 answer times', () => {
    expect(paceOf([])).toBeNull();
    expect(paceOf(times(19))).toBeNull();
  });

  it('is the median from 20 answer times', () => {
    // 1000 to 20000: the midpoint of the tenth and eleventh.
    expect(paceOf(times(20))).toBe(10500);
  });

  it('is the median of however many are kept above 20', () => {
    expect(paceOf(times(21))).toBe(11000);
  });
});

describe('answerTime', () => {
  it('caps at 20 seconds', () => {
    expect(TIME_CAP).toBe(20_000);
    expect(answerTime(45_000, false)).toBe(TIME_CAP);
  });

  it('is the elapsed time in whole milliseconds under the cap', () => {
    expect(answerTime(2400.4, false)).toBe(2400);
    expect(answerTime(2400.5, false)).toBe(2401);
  });

  it('is the cap for a presentation the app went to the background during', () => {
    expect(answerTime(120, true)).toBe(TIME_CAP);
    expect(answerTime(45_000, true)).toBe(TIME_CAP);
  });
});

describe('gradeAnswer', () => {
  it('grades a wrong answer missed whatever its answer time', () => {
    expect(gradeAnswer(false, 0, null)).toBe('missed');
    expect(gradeAnswer(false, 400, 4000)).toBe('missed');
    expect(gradeAnswer(false, TIME_CAP, 4000)).toBe('missed');
  });

  it('grades every right answer fast while there is no pace', () => {
    expect(gradeAnswer(true, 0, null)).toBe('fast');
    expect(gradeAnswer(true, 12_000, null)).toBe('fast');
    expect(gradeAnswer(true, TIME_CAP, null)).toBe('fast');
  });

  it('grades a right answer at 1.5 times the pace fast', () => {
    expect(gradeAnswer(true, 6000, 4000)).toBe('fast');
  });

  it('grades a right answer over 1.5 times the pace slow', () => {
    expect(gradeAnswer(true, 6001, 4000)).toBe('slow');
  });

  it('grades a right answer under 3 seconds fast, however far over the pace', () => {
    // A pace of 1 second puts 1.5 × pace at 1.5 seconds, under the floor.
    expect(gradeAnswer(true, 2999, 1000)).toBe('fast');
    expect(gradeAnswer(true, 3000, 1000)).toBe('slow');
  });

  it('grades an answer at the cap by the same rule', () => {
    expect(gradeAnswer(true, TIME_CAP, 4000)).toBe('slow');
    expect(gradeAnswer(true, TIME_CAP, 19_000)).toBe('fast');
  });
});

describe('keepTime', () => {
  it('keeps 60 answer times', () => {
    expect(TIMES_KEPT).toBe(60);
  });

  it('appends an answer time under the cap', () => {
    expect(keepTime([1000, 2000], 2400)).toEqual([1000, 2000, 2400]);
  });

  it('does not keep an answer time at the cap', () => {
    expect(keepTime([1000, 2000], TIME_CAP)).toEqual([1000, 2000]);
  });

  it('drops the oldest once 60 are kept', () => {
    const kept = keepTime(times(TIMES_KEPT), 400);
    expect(kept).toHaveLength(TIMES_KEPT);
    expect(kept[0]).toBe(2000);
    expect(kept.at(-1)).toBe(400);
  });

  it('leaves the given answer times as they were', () => {
    const before = times(3);
    keepTime(before, 500);
    expect(before).toEqual(times(3));
  });
});
