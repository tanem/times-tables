// How well the learner knows a fact, from 0 (new or just missed) to 4.
export type Level = 0 | 1 | 2 | 3 | 4;

// The learner's grade for one presentation.
export type Outcome = 'fast' | 'slow' | 'missed';

// An outcome where the learner got the answer: the ones a correction can
// re-grade as missed.
export type GotOutcome = Exclude<Outcome, 'missed'>;

// The draw weight of a fact at each level, so that low-level facts come round
// more often and no fact is ever retired.
const WEIGHTS: Readonly<Record<Level, number>> = {
  0: 8,
  1: 4,
  2: 2,
  3: 1,
  4: 1,
};

// The level a fact moves to on an outcome: fast adds one, capped at 4; slow
// subtracts one, floored at 0; missed sets it to 0.
export function grade(level: Level, outcome: Outcome): Level {
  if (outcome === 'fast') return Math.min(4, level + 1) as Level;
  if (outcome === 'slow') return Math.max(0, level - 1) as Level;
  return 0;
}

export function weightOf(level: Level): number {
  return WEIGHTS[level];
}
