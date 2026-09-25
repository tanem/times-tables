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

// What the meter under a character reads: the stretch of drills from the
// last threshold passed to the next, the drills it shows within that
// stretch, the share of it done, from 0 to 1, and whether every bond pose is
// open. Past the last threshold the meter stays on the last stretch, full.
export type BondReading = {
  from: number;
  to: number;
  now: number;
  share: number;
  full: boolean;
};

export function bondReading(count: number): BondReading {
  let from = 0;
  for (const to of BOND_AT) {
    if (count < to) {
      const share = (count - from) / (to - from);
      return { from, to, now: count, share, full: false };
    }
    from = to;
  }
  const [, second, last] = BOND_AT;
  return { from: second, to: last, now: last, share: 1, full: true };
}
