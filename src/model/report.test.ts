import { describe, expect, it } from 'vitest';
import { factKey } from './facts';
import {
  applyOutcome,
  freshProgress,
  type DrillRecord,
  type OutcomeCounts,
} from './progress';
import type { Day } from '../time';
import {
  countsLine,
  dateWording,
  earlyLine,
  gemsLine,
  GRID_COLUMNS,
  gridRows,
  recentRows,
  trendChart,
  trendFigures,
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
  outcomes: OutcomeCounts,
  quit = false,
  tables: DrillRecord['tables'] = [6],
): DrillRecord {
  return {
    at,
    tables,
    quit,
    pace: null,
    known: 0,
    median: null,
    ...outcomes,
  };
}

// A drill record with the figures the trend reads: the pace and the facts
// known at its end.
function paced(
  at: string,
  pace: number | null,
  known: number,
  outcomes: OutcomeCounts = { fast: 20, slow: 0, missed: 0 },
  tables: DrillRecord['tables'] = [6],
): DrillRecord {
  return { ...drill(at, outcomes, false, tables), pace, known };
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

  it('counts a drill and a quit drill alike, and sums the facts answered', () => {
    const records = [
      drill('2026-09-15', { fast: 10, slow: 2, missed: 1 }),
      drill('2026-09-14', { fast: 2, slow: 0, missed: 5 }, true),
    ];
    expect(weekLine(records, dayOfStub, today)).toBe(
      'This week: 2 drills, 20 facts answered, 60% fast',
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

  it('reads all eleven tables as All tables', () => {
    const records = [
      drill(
        '2026-09-15',
        { fast: 20, slow: 0, missed: 0 },
        false,
        [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      ),
    ];
    expect(recentRows(records, dayOfStub, today)).toEqual([
      'Today · All tables · 20 fast · 0 slow · 0 missed',
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
  it('gives eleven rows of twelve cells labelled by table and multiplier', () => {
    const rows = gridRows(freshProgress());
    expect(rows.map((row) => row.label)).toEqual([
      '2s',
      '3s',
      '4s',
      '5s',
      '6s',
      '7s',
      '8s',
      '9s',
      '10s',
      '11s',
      '12s',
    ]);
    for (const row of rows) expect(row.cells).toHaveLength(12);

    const first = rows[0]?.cells[0];
    expect(first).toMatchObject({
      label: '2 × 1',
      level: 0,
      counts: { fast: 0, slow: 0, missed: 0 },
      ariaLabel: '2 × 1, level 0',
    });
  });

  it('gives each cell the product it shows, under columns 1 to 12', () => {
    const sixes = gridRows(freshProgress())[4];
    expect(sixes?.cells.map((cell) => cell.product)).toEqual([
      6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72,
    ]);
    expect(GRID_COLUMNS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('gives an overlap fact the same level and counts in both its rows', () => {
    const progress = applyOutcome(freshProgress(), '6x8', 'fast');
    const rows = gridRows(progress);

    const inSixes = rows[4]?.cells.find((cell) => cell.label === '6 × 8');
    const inEights = rows[6]?.cells.find((cell) => cell.label === '8 × 6');
    expect(inSixes?.level).toBe(1);
    expect(inEights?.level).toBe(1);
    expect(inSixes?.counts).toEqual(inEights?.counts);
    expect(inSixes?.counts).toEqual({ fast: 1, slow: 0, missed: 0 });
  });

  it('marks a row with a badge and names it so, even with its levels dropped', () => {
    let progress = freshProgress();
    for (let n = 1; n <= 12; n++) {
      for (let times = 0; times < 4; times++) {
        progress = applyOutcome(progress, factKey(7, n), 'fast');
      }
    }
    progress = applyOutcome(progress, '7x8', 'missed');
    const rows = gridRows(progress);
    const sevens = rows[5];
    expect(sevens).toMatchObject({
      label: '7s',
      badge: true,
      ariaLabel: '7s, badge',
    });
    expect(rows[4]).toMatchObject({
      label: '6s',
      badge: false,
      ariaLabel: '6s',
    });
  });
});

describe('countsLine', () => {
  it('reads a cell’s label and lifetime counts', () => {
    const progress = applyOutcome(
      applyOutcome(freshProgress(), '6x7', 'fast'),
      '6x7',
      'slow',
    );
    const cell = gridRows(progress)[4]?.cells.find(
      (candidate) => candidate.label === '6 × 7',
    );
    if (!cell) throw new Error('cell not found');
    expect(countsLine(cell)).toBe('6 × 7: fast 1, slow 1, missed 0');
  });
});

describe('trendFigures', () => {
  it('gives no figures when there are no drills', () => {
    expect(trendFigures([], dayOfStub, today)).toEqual([]);
  });

  it('sets the last seven days against the seven days that ended 28 days ago', () => {
    const records = [
      // 35 days before today: a day too old for the earlier week.
      paced('2026-08-11', 9000, 1, { fast: 0, slow: 0, missed: 20 }),
      // 34 and 28 days before today: the earlier week's two ends.
      paced('2026-08-12', 6000, 4, { fast: 5, slow: 10, missed: 5 }),
      paced('2026-08-18', 5240, 9, { fast: 10, slow: 5, missed: 5 }),
      // 27 days before today: in neither week.
      paced('2026-08-19', 8000, 10, { fast: 0, slow: 0, missed: 20 }),
      // Six days before today, and today.
      paced('2026-09-09', 3100, 20, { fast: 15, slow: 5, missed: 0 }),
      paced('2026-09-15', 2960, 21, { fast: 18, slow: 1, missed: 1 }),
    ];
    expect(trendFigures(records, dayOfStub, today)).toEqual([
      { label: 'Pace', now: '3.0 s', earlier: '5.2 s four weeks ago' },
      { label: 'Facts known', now: '21 of 77', earlier: '9 four weeks ago' },
      { label: 'Fast answers', now: '83%', earlier: '38% four weeks ago' },
    ]);
  });

  it('has nothing to compare until there is practice from four weeks ago', () => {
    const records = [
      paced('2026-09-15', null, 0, { fast: 3, slow: 0, missed: 1 }),
    ];
    expect(trendFigures(records, dayOfStub, today)).toEqual([
      { label: 'Pace', now: '–', earlier: 'nothing to compare yet' },
      {
        label: 'Facts known',
        now: '0 of 77',
        earlier: 'nothing to compare yet',
      },
      { label: 'Fast answers', now: '75%', earlier: 'nothing to compare yet' },
    ]);
  });

  it('reads the last drill of all when this week has none', () => {
    const records = [paced('2026-09-01', 4000, 12)];
    expect(trendFigures(records, dayOfStub, today)).toEqual([
      { label: 'Pace', now: '4.0 s', earlier: 'nothing to compare yet' },
      {
        label: 'Facts known',
        now: '12 of 77',
        earlier: 'nothing to compare yet',
      },
      { label: 'Fast answers', now: '–', earlier: 'nothing to compare yet' },
    ]);
  });
});

describe('earlyLine', () => {
  it('says when a trend shows while there are no drills', () => {
    expect(earlyLine(freshProgress())).toBe(
      'A trend shows here once there is practice to compare.',
    );
  });

  it('says how far off a pace is until 20 answer times are kept', () => {
    const progress = {
      ...freshProgress(),
      times: Array<number>(7).fill(2000),
      records: [paced('2026-09-15', null, 0)],
    };
    expect(earlyLine(progress)).toBe(
      'No pace yet: it starts after 20 right answers (7 so far).',
    );
  });

  it('says nothing once there is a pace', () => {
    const progress = {
      ...freshProgress(),
      times: Array<number>(20).fill(2000),
      records: [paced('2026-09-15', 2000, 0)],
    };
    expect(earlyLine(progress)).toBeNull();
  });
});

describe('gemsLine', () => {
  it('says what was earned and what is left to spend', () => {
    const progress = { ...freshProgress(), earned: 312, balance: 47 };
    expect(gemsLine(progress)).toBe('Gems: 312 earned, 47 to spend');
  });

  it('says so when nothing has been earned', () => {
    expect(gemsLine(freshProgress())).toBe('Gems: 0 earned, 0 to spend');
  });
});

describe('trendChart', () => {
  // Five drills four days apart, the last one today.
  const five = [
    paced('2026-08-30', 8000, 0),
    paced('2026-09-03', 6000, 0),
    paced('2026-09-07', 4000, 0),
    paced('2026-09-11', 2000, 0),
    paced('2026-09-15', 2000, 0),
  ];

  it('gives no chart until five drills have a pace', () => {
    const records = [paced('2026-08-29', null, 0), ...five.slice(1)];
    expect(trendChart(records, dayOfStub, today)).toBeNull();
  });

  it('plots pace drill by drill from zero, from the first charted day to today', () => {
    expect(trendChart(five, dayOfStub, today)).toEqual({
      points: [
        { x: 0, y: 1 },
        { x: 0.25, y: 0.75 },
        { x: 0.5, y: 0.5 },
        { x: 0.75, y: 0.25 },
        { x: 1, y: 0.25 },
      ],
      marks: [],
      span: '2 weeks ago',
      highest: 'highest 8.0 s',
    });
  });

  it('marks the drills where tables were switched on', () => {
    const records = [
      paced('2026-08-30', 8000, 0),
      paced('2026-09-03', 6000, 0),
      paced('2026-09-07', 4000, 0, undefined, [6, 8]),
      // Switching a table off leaves no mark.
      paced('2026-09-11', 2000, 0, undefined, [8]),
      paced('2026-09-15', 2000, 0, undefined, [7, 8, 9]),
    ];
    expect(trendChart(records, dayOfStub, today)?.marks).toEqual([
      { x: 0.5, label: '8s added' },
      { x: 1, label: '7s and 9s added' },
    ]);
  });

  it('marks a drill with no pace, and none before the line starts', () => {
    const records = [
      paced('2026-08-20', null, 0),
      paced('2026-08-25', null, 0, undefined, [6, 8]),
      paced('2026-08-30', 8000, 0, undefined, [6, 8]),
      paced('2026-09-03', 6000, 0, undefined, [6, 8]),
      paced('2026-09-05', null, 0, undefined, [6, 8, 12]),
      paced('2026-09-07', 4000, 0, undefined, [6, 8, 12]),
      paced('2026-09-11', 2000, 0, undefined, [6, 8, 12]),
      paced('2026-09-15', 2000, 0, undefined, [6, 8, 12]),
    ];
    expect(trendChart(records, dayOfStub, today)?.marks).toEqual([
      { x: 0.375, label: '12s added' },
    ]);
  });

  it('covers the last twelve weeks', () => {
    const records = [
      // 84 days before today: a day too old. 83 days before: the first day.
      paced('2026-06-23', 9000, 0),
      paced('2026-06-24', 4000, 0),
      ...five.slice(1),
    ];
    const chart = trendChart(records, dayOfStub, today);
    expect(chart?.points).toHaveLength(5);
    expect(chart?.span).toBe('12 weeks ago');
    expect(chart?.highest).toBe('highest 6.0 s');
  });

  it('gives no chart while every drill with a pace fell on one day', () => {
    const records = Array.from({ length: 5 }, () =>
      paced('2026-09-15', 3000, 0),
    );
    expect(trendChart(records, dayOfStub, today)).toBeNull();
  });

  it('captions a span under two weeks in days', () => {
    const records = [
      paced('2026-09-02', 5000, 0),
      ...Array.from({ length: 4 }, () => paced('2026-09-15', 3000, 0)),
    ];
    expect(trendChart(records, dayOfStub, today)?.span).toBe('13 days ago');
  });
});
