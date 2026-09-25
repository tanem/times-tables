// The finished drills with a character at which its bond poses open, in
// order (ADR 0005).
export const BOND_AT = [10, 25, 50] as const;

// How many of a character's bond poses are open, from none to all three.
export type BondLevel = 0 | 1 | 2 | 3;

// The bond level of a character from its count of finished drills: one for
// each threshold reached.
export function bondLevel(count: number): BondLevel {
  return BOND_AT.filter((at) => count >= at).length as BondLevel;
}

// What the meter under a character shows: the stretch of drills from the
// last threshold passed to the next, and the share of it done, from 0 to 1.
// Past the last threshold the meter stays on the last stretch, full.
export type BondMeter = { from: number; to: number; share: number };

export function bondMeter(count: number): BondMeter {
  let from = 0;
  for (const to of BOND_AT) {
    if (count < to) return { from, to, share: (count - from) / (to - from) };
    from = to;
  }
  const [, second, last] = BOND_AT;
  return { from: second, to: last, share: 1 };
}
