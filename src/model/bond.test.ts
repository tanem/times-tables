import { describe, expect, it } from 'vitest';
import { BOND_AT, bondLevel, bondReading } from './bond';

describe('the bond thresholds', () => {
  it('open a pose at 10, 25 and 50 finished drills', () => {
    expect(BOND_AT).toEqual([10, 25, 50]);
  });
});

describe('bondLevel', () => {
  it('is 0 until the first threshold', () => {
    expect(bondLevel(0)).toBe(0);
    expect(bondLevel(9)).toBe(0);
  });

  it('rises by one at each threshold', () => {
    expect(bondLevel(10)).toBe(1);
    expect(bondLevel(24)).toBe(1);
    expect(bondLevel(25)).toBe(2);
    expect(bondLevel(49)).toBe(2);
    expect(bondLevel(50)).toBe(3);
  });

  it('stays at 3 past the last threshold', () => {
    expect(bondLevel(51)).toBe(3);
    expect(bondLevel(1000)).toBe(3);
  });
});

describe('bondReading', () => {
  it('spans the drills from the last threshold passed to the next', () => {
    for (const [count, from, to, share] of [
      [0, 0, 10, 0],
      [4, 0, 10, 0.4],
      [10, 10, 25, 0],
      [16, 10, 25, 0.4],
      [25, 25, 50, 0],
      [35, 25, 50, 0.4],
    ] as const) {
      expect(bondReading(count)).toEqual({
        from,
        to,
        now: count,
        share,
        full: false,
      });
    }
  });

  it('is full at 50 and beyond, the drills it shows held at 50', () => {
    for (const count of [50, 80]) {
      expect(bondReading(count)).toEqual({
        from: 25,
        to: 50,
        now: 50,
        share: 1,
        full: true,
      });
    }
  });
});
