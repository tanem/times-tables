import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  freshProgress,
  type DrillRecord,
  type Progress,
} from './progress';
import type { Day } from '../time';
import {
  bestLine,
  countsLine,
  dateWording,
  gridRows,
  recentRows,
  weekLine,
} from './report';

const day = (
  ordinal: number,
  weekday: number,
  date: number,
  month: number,
): Day => ({
  ordinal,
  weekday,
  date,
  month,
});

// Reads an ISO date's own calendar day, so the tests read as plain
// arithmetic against a fixed "today" without touching the real clock.
function dayOfStub(at: string): Day {
  const [, y, m, d] = /^(\d{4})-(\d{2})-(\d{2})/.exec(at) ?? [];
  const ordinal = Math.floor(
    Date.UTC(Number(y), Number(m) - 1, Number(d)) / 86400000,
  );
  return { ordinal, weekday: 0, date: Number(d), month: Number(m) - 1 };
}

const today = dayOfStub('2026-09-15');

function drill(
  at: string,
  outcomes: { fast: number; slow: number; missed: number },
  quit = false,
  tables: DrillRecord['tables'] = [6],
): DrillRecord {
  return { mode: 'drill', at, tables, quit, time: null, ...outcomes };
}

function speedRun(
  at: string,
  outcomes: { fast: number; slow: number; missed: number },
  time: number | null = 100000,
): DrillRecord {
  return {
    mode: 'speed',
    at,
    tables: [6, 8, 12],
    quit: time === null,
    time,
    ...outcomes,
  };
}

describe('dateWording', () => {
  const today = day(100, 2, 15, 8); // Tuesday 15 September

  it('reads the same ordinal as Today', () => {
    expect(dateWording(today, today)).toBe('Today');
  });

  it('reads the ordinal one before as Yesterday', () => {
    const yesterday = day(99, 1, 14, 8);
    expect(dateWording(yesterday, today)).toBe('Yesterday');
  });

  it('reads any other past day as its weekday and date', () => {
    const monday = day(93, 1, 8, 8); // Monday 8 September
    expect(dateWording(monday, today)).toBe('Mon 8 Sep');
  });

  it('reads a future day the same way as any other day', () => {
    const nextTuesday = day(107, 2, 22, 8); // Tuesday 22 September
    expect(dateWording(nextTuesday, today)).toBe('Tue 22 Sep');
  });
});

describe('weekLine', () => {
  it('reads no records as no practice', () => {
    expect(weekLine([], dayOfStub, today)).toBe('No practice this week');
  });

  it('counts a drill, a quit drill and a speed run alike, and sums the facts answered', () => {
    const records = [
      drill('2026-09-15', { fast: 10, slow: 2, missed: 1 }),
      drill('2026-09-14', { fast: 2, slow: 0, missed: 5 }, true),
      speedRun('2026-09-13', { fast: 30, slow: 2, missed: 1 }),
    ];
    expect(weekLine(records, dayOfStub, today)).toBe(
      'This week: 3 drills, 53 facts answered, 79% fast',
    );
  });

  it('uses the singular for one drill and one fact answered', () => {
    const records = [drill('2026-09-15', { fast: 1, slow: 0, missed: 0 })];
    expect(weekLine(records, dayOfStub, today)).toBe(
      'This week: 1 drill, 1 fact answered, 100% fast',
    );
  });

  it('omits the fast share when nothing was answered', () => {
    const records = [
      drill('2026-09-15', { fast: 0, slow: 0, missed: 0 }, true),
    ];
    expect(weekLine(records, dayOfStub, today)).toBe(
      'This week: 1 drill, 0 facts answered',
    );
  });

  it('includes a record six days old and excludes one seven days old', () => {
    const records = [
      drill('2026-09-09', { fast: 1, slow: 0, missed: 0 }), // 6 days before
      drill('2026-09-08', { fast: 1, slow: 0, missed: 0 }), // 7 days before
    ];
    expect(weekLine(records, dayOfStub, today)).toBe(
      'This week: 1 drill, 1 fact answered, 100% fast',
    );
  });
});

describe('bestLine', () => {
  const withBest = (at: string): Progress => ({
    ...freshProgress(),
    records: [speedRun(at, { fast: 33, slow: 0, missed: 0 })],
  });

  it('reads no completed speed run as none', () => {
    expect(bestLine(freshProgress(), dayOfStub, today)).toBe(
      'No completed speed run yet',
    );
  });

  it('gives the best time with a dated wording', () => {
    expect(bestLine(withBest('2026-09-08'), dayOfStub, today)).toBe(
      'Best 1:40.0, set Sun 8 Sep',
    );
  });

  it('lower-cases today and yesterday in the dated wording', () => {
    expect(bestLine(withBest('2026-09-15'), dayOfStub, today)).toBe(
      'Best 1:40.0, set today',
    );
    expect(bestLine(withBest('2026-09-14'), dayOfStub, today)).toBe(
      'Best 1:40.0, set yesterday',
    );
  });
});

describe('recentRows', () => {
  it('reads no records as no rows', () => {
    expect(recentRows([], dayOfStub, today)).toEqual([]);
  });

  it('shows a finished drill with its date, tables and tally', () => {
    const records = [
      drill('2026-09-15', { fast: 14, slow: 4, missed: 2 }, false, [6, 8]),
    ];
    expect(recentRows(records, dayOfStub, today)).toEqual([
      'Today · 6s and 8s · 14 fast · 4 slow · 2 missed',
    ]);
  });

  it('adds how far a quit drill got', () => {
    const records = [
      drill('2026-09-15', { fast: 2, slow: 0, missed: 1 }, true, [6, 8, 12]),
    ];
    expect(recentRows(records, dayOfStub, today)).toEqual([
      'Today · 6s, 8s and 12s · 2 fast · 0 slow · 1 missed · stopped at 3 of 20',
    ]);
  });

  it('shows a completed speed run with its time and miss count', () => {
    const records = [speedRun('2026-09-15', { fast: 33, slow: 0, missed: 2 })];
    expect(recentRows(records, dayOfStub, today)).toEqual([
      'Today · Speed run · 1:40.0 · 2 missed',
    ]);
  });

  it('shows a quit speed run as stopped, with no time', () => {
    const records = [
      speedRun('2026-09-15', { fast: 10, slow: 0, missed: 3 }, null),
    ];
    expect(recentRows(records, dayOfStub, today)).toEqual([
      'Today · Speed run · stopped · 3 missed',
    ]);
  });

  it('shows the ten most recent records newest first', () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      drill(`2026-09-0${(i % 9) + 1}`, { fast: i, slow: 0, missed: 0 }),
    );
    const rows = recentRows(records, dayOfStub, today);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toContain('11 fast');
    expect(rows[9]).toContain('2 fast');
  });
});

describe('gridRows', () => {
  it('gives three rows of twelve cells labelled by table and multiplier', () => {
    const rows = gridRows(freshProgress());
    expect(rows.map((row) => row.label)).toEqual(['6s', '8s', '12s']);
    for (const row of rows) expect(row.cells).toHaveLength(12);

    const first = rows[0]?.cells[0];
    expect(first).toMatchObject({
      key: '1x6',
      label: '6 × 1',
      level: 0,
      counts: { fast: 0, slow: 0, missed: 0 },
      ariaLabel: '6 × 1, level 0',
    });
  });

  it('gives an overlap fact the same key and level in both its rows', () => {
    const progress = applyOutcome(freshProgress(), '6x8', 'fast');
    const rows = gridRows(progress);

    const inSixes = rows[0]?.cells.find((cell) => cell.label === '6 × 8');
    const inEights = rows[1]?.cells.find((cell) => cell.label === '8 × 6');
    expect(inSixes?.key).toBe('6x8');
    expect(inEights?.key).toBe('6x8');
    expect(inSixes?.level).toBe(1);
    expect(inEights?.level).toBe(1);
  });
});

describe('countsLine', () => {
  it('reads a cell’s label and lifetime counts', () => {
    const progress = applyOutcome(
      applyOutcome(freshProgress(), '6x7', 'fast'),
      '6x7',
      'slow',
    );
    const cell = gridRows(progress)[0]?.cells.find(
      (candidate) => candidate.label === '6 × 7',
    );
    if (!cell) throw new Error('cell not found');
    expect(countsLine(cell)).toBe('6 × 7: fast 1, slow 1, missed 0');
  });
});
