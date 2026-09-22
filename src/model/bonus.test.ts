import { describe, expect, it } from 'vitest';
import { BONUS, fasterThanLastTime, RIGHT_NEEDED } from './bonus';
import type { DrillRecord } from './progress';

// A drill record with the given parts over a finished drill of ten right
// answers on the seeded tables.
function record(parts: Partial<DrillRecord> = {}): DrillRecord {
  return {
    at: '2026-01-01T09:00:00.000Z',
    tables: [6, 8, 12],
    fast: 10,
    slow: 0,
    missed: 10,
    quit: false,
    pace: null,
    known: 0,
    median: 5000,
    ...parts,
  };
}

describe('fasterThanLastTime', () => {
  it('pays a drill with a lower median than the last on the same tables', () => {
    const last = record({ median: 6000 });

    expect(fasterThanLastTime([last], record({ median: 5000 }))).toBe(true);
  });

  it('does not pay a drill that matched the last median', () => {
    const last = record({ median: 5000 });

    expect(fasterThanLastTime([last], record({ median: 5000 }))).toBe(false);
  });

  it('does not pay a drill slower than the last', () => {
    const last = record({ median: 5000 });

    expect(fasterThanLastTime([last], record({ median: 6000 }))).toBe(false);
  });

  it('does not pay the first drill on its tables', () => {
    expect(fasterThanLastTime([], record({ median: 5000 }))).toBe(false);
  });

  it('reads the same tables in another order as the same tables', () => {
    const last = record({ tables: [12, 6, 8], median: 6000 });

    expect(
      fasterThanLastTime([last], record({ tables: [6, 8, 12], median: 5000 })),
    ).toBe(true);
  });

  it('skips over a drill on other tables', () => {
    const others = record({ tables: [6, 8], median: 9000 });

    expect(fasterThanLastTime([others], record({ tables: [6, 8, 12] }))).toBe(
      false,
    );
  });

  it('skips over a quit drill to the finished one before it', () => {
    const earlier = record({ median: 6000 });
    const quit = record({ quit: true, median: 1000 });

    expect(fasterThanLastTime([earlier, quit], record({ median: 5000 }))).toBe(
      true,
    );
  });

  it('never pays a drill that was quit', () => {
    const last = record({ median: 6000 });

    expect(
      fasterThanLastTime([last], record({ quit: true, median: 5000 })),
    ).toBe(false);
  });

  it('does not pay a drill with fewer than ten right answers', () => {
    const last = record({ median: 6000 });
    const few = record({ fast: 6, slow: 3, missed: 11, median: 5000 });

    expect(fasterThanLastTime([last], few)).toBe(false);
  });

  it('does not pay against a last time with fewer than ten right answers', () => {
    const last = record({ fast: 5, slow: 4, missed: 11, median: 6000 });

    expect(fasterThanLastTime([last], record({ median: 5000 }))).toBe(false);
  });

  it('does not pay a drill with no median', () => {
    const last = record({ median: 6000 });

    expect(fasterThanLastTime([last], record({ median: null }))).toBe(false);
  });

  it('does not pay against a last time with no median', () => {
    const last = record({ median: null });

    expect(fasterThanLastTime([last], record({ median: 5000 }))).toBe(false);
  });

  // "Faster than last time!" names the drill before this one, so a last time
  // there is nothing to compare with ends the comparison.
  it('does not look past a last time that cannot be compared', () => {
    const older = record({ median: 6000 });
    const last = record({ fast: 4, slow: 2, missed: 14, median: 1000 });

    expect(fasterThanLastTime([older, last], record({ median: 5000 }))).toBe(
      false,
    );
  });
});

describe('BONUS', () => {
  it('is two gems', () => {
    expect(BONUS).toBe(2);
  });
});

describe('RIGHT_NEEDED', () => {
  it('is ten right answers', () => {
    expect(RIGHT_NEEDED).toBe(10);
  });
});
