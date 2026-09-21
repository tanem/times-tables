// The pace rule of docs/adr/0002: a learner's pace is the median of the
// answer times of their own recent right answers, and a right answer well
// over that pace is slow.

import type { Outcome } from './level';

// An answer time stops counting at the cap, in milliseconds, so that time
// spent away from the iPad does not distort pace.
export const TIME_CAP = 20_000;

// How many answer times the learner keeps: three to four drills of them.
export const TIMES_KEPT = 60;

// How many answer times a learner has to have kept before they have a pace.
export const PACE_NEEDED = 20;

// How far over the pace a right answer goes before it is slow.
const MARGIN = 1.5;

// The margin never puts the line below this, in milliseconds, so that
// ordinary variation at a quick pace does not grade a fact the learner knows
// cold as slow. It is never shown.
const FLOOR = 3000;

// The median of the given answer times, rounded to the nearest whole
// millisecond, or null when there are none.
export function medianTime(times: readonly number[]): number | null {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  const median =
    sorted.length % 2
      ? (sorted[Math.floor(middle)] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return Math.round(median);
}

// The learner's pace from the answer times they have kept: the median once
// there are enough of them, and null until then.
export function paceOf(times: readonly number[]): number | null {
  return times.length < PACE_NEEDED ? null : medianTime(times);
}

// The answer time of one presentation, in whole milliseconds: the time it
// took, capped. A presentation the app went to the background during sits at
// the cap whatever the clock says, since the clock is unreliable across it.
export function answerTime(elapsed: number, backgrounded: boolean): number {
  return backgrounded ? TIME_CAP : Math.min(TIME_CAP, Math.round(elapsed));
}

// The outcome of one presentation, graded against the pace as it stood
// before the answer: a wrong answer is missed whatever its answer time, a
// right answer is slow when it is over the margin and past the floor, and
// every other right answer, a right answer with no pace included, is fast.
export function gradeAnswer(
  right: boolean,
  time: number,
  pace: number | null,
): Outcome {
  if (!right) return 'missed';
  if (pace === null) return 'fast';
  return time > MARGIN * pace && time >= FLOOR ? 'slow' : 'fast';
}

// The answer times to keep after one more: a time under the cap is appended
// and the oldest fall away past TIMES_KEPT, and a time at the cap is not
// kept at all. Only the times of right answers are ever passed.
export function keepTime(times: readonly number[], time: number): number[] {
  if (time >= TIME_CAP) return [...times];
  return [...times, time].slice(-TIMES_KEPT);
}
