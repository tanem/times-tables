import { describe, expect, it } from 'vitest';
import { BOND_AT, bondLevel, bondMeter } from './bond';

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

describe('bondMeter', () => {
  it('spans the drills from the last threshold passed to the next', () => {
    expect(bondMeter(0)).toEqual({ from: 0, to: 10, share: 0 });
    expect(bondMeter(4)).toEqual({ from: 0, to: 10, share: 0.4 });
    expect(bondMeter(10)).toEqual({ from: 10, to: 25, share: 0 });
    expect(bondMeter(16)).toEqual({ from: 10, to: 25, share: 0.4 });
    expect(bondMeter(25)).toEqual({ from: 25, to: 50, share: 0 });
    expect(bondMeter(35)).toEqual({ from: 25, to: 50, share: 0.4 });
  });

  it('is full at 50 and beyond', () => {
    expect(bondMeter(50)).toEqual({ from: 25, to: 50, share: 1 });
    expect(bondMeter(80)).toEqual({ from: 25, to: 50, share: 1 });
  });
});
