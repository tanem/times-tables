// The Parent view's model: pure functions from a Progress document and
// calendar days to the strings and data the screen shows. No clock, no DOM.

import { DRILL_LENGTH } from './drill';
import { factKey, FACTS, TABLES, tablesList, type Table } from './facts';
import type { Level } from './level';
import { PACE_NEEDED, paceOf, TIMES_KEPT } from './pace';
import {
  factCounts,
  factLevel,
  type DrillRecord,
  type OutcomeCounts,
  type Progress,
} from './progress';
import type { Day } from '../time';

// Reads the local calendar day a stored timestamp falls on.
export type DayOf = (timestamp: string) => Day;

// A count with its word, singular when the count is 1.
function counted(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// A day's wording relative to today: "Today", "Yesterday", or its weekday
// and date such as "Tue 15 Sep" for any other day, past or future.
export function dateWording(day: Day, today: Day): string {
  const diff = today.ordinal - day.ordinal;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${WEEKDAYS[day.weekday]} ${day.date} ${MONTHS[day.month]}`;
}

// The number of presentations a record answered, whether it ran to the end
// or was quit.
function answered(record: DrillRecord): number {
  return record.fast + record.slow + record.missed;
}

// The calendar week is a rolling seven days: today and the six days before
// it. A future-dated day (a later ordinal than today) falls outside it.
function inWeek(day: Day, today: Day): boolean {
  const diff = today.ordinal - day.ordinal;
  return diff >= 0 && diff <= 6;
}

// The share of the records' answers that were fast, as a whole percentage,
// or null when nothing was answered.
function fastShare(records: readonly DrillRecord[]): number | null {
  const total = records.reduce((sum, record) => sum + answered(record), 0);
  if (total === 0) return null;
  const fast = records.reduce((sum, record) => sum + record.fast, 0);
  return Math.round((fast / total) * 100);
}

// This calendar week's practice: how many drills (a quit drill counts as a
// drill), how many facts were answered across them, and what share of those
// were fast. "No practice this week" when there are none.
export function weekLine(
  records: readonly DrillRecord[],
  dayOf: DayOf,
  today: Day,
): string {
  const week = records.filter((record) => inWeek(dayOf(record.at), today));
  if (week.length === 0) return 'No practice this week';

  const totalAnswered = week.reduce((sum, record) => sum + answered(record), 0);
  const line = `This week: ${counted(week.length, 'drill')}, ${counted(totalAnswered, 'fact')} answered`;
  const share = fastShare(week);
  return share === null ? line : `${line}, ${share}% fast`;
}

// The tables a record covers: the list, or "All tables" for all eleven.
function tablesWording(tables: readonly Table[]): string {
  return tables.length === TABLES.length ? 'All tables' : tablesList(tables);
}

// A drill's row: its date, tables and tally, with how far it got if it was
// quit early.
function drillRow(record: DrillRecord, day: Day, today: Day): string {
  const parts = [
    dateWording(day, today),
    tablesWording(record.tables),
    `${record.fast} fast · ${record.slow} slow · ${record.missed} missed`,
  ];
  if (record.quit) {
    parts.push(`stopped at ${answered(record)} of ${DRILL_LENGTH}`);
  }
  return parts.join(' · ');
}

// The ten most recent drills, newest first, each as one visible row.
export function recentRows(
  records: readonly DrillRecord[],
  dayOf: DayOf,
  today: Day,
): string[] {
  return records
    .slice(-10)
    .reverse()
    .map((record) => drillRow(record, dayOf(record.at), today));
}

// A time in milliseconds as the parent reads it, in seconds to one place.
function seconds(time: number): string {
  return `${(time / 1000).toFixed(1)} s`;
}

// How many days before today the trend's earlier week ends.
const EARLIER_DAYS_AGO = 28;

// One figure of the trend: its value now, and its value four weeks ago or
// that there is nothing to compare yet.
export type TrendFigure = {
  label: string;
  now: string;
  earlier: string;
};

// A figure from its value now and its value four weeks ago, null when there
// is none.
function figure(
  label: string,
  now: string,
  earlier: string | null,
): TrendFigure {
  return {
    label,
    now,
    earlier:
      earlier === null ? 'nothing to compare yet' : `${earlier} four weeks ago`,
  };
}

// The trend's three figures, each now against four weeks ago: pace, facts
// known and the share of fast answers. "Now" is the last seven days and
// "four weeks ago" is the seven days that ended 28 days ago. Pace and facts
// known read the last drill of each week, and now falls back to the last
// drill of all when this week has none. No figures when there are no drills.
export function trendFigures(
  records: readonly DrillRecord[],
  dayOf: DayOf,
  today: Day,
): TrendFigure[] {
  const last = records.at(-1);
  if (!last) return [];

  const week = records.filter((record) => inWeek(dayOf(record.at), today));
  const earlierWeek = records.filter((record) => {
    const days = today.ordinal - dayOf(record.at).ordinal;
    return days >= EARLIER_DAYS_AGO && days < EARLIER_DAYS_AGO + 7;
  });
  const now = week.at(-1) ?? last;
  const earlier = earlierWeek.at(-1);

  const shareNow = fastShare(week);
  const paceThen = earlier?.pace ?? null;
  const shareThen = fastShare(earlierWeek);

  return [
    figure(
      'Pace',
      now.pace === null ? '–' : seconds(now.pace),
      paceThen === null ? null : seconds(paceThen),
    ),
    figure(
      'Facts known',
      `${now.known} of ${FACTS.length}`,
      earlier ? `${earlier.known}` : null,
    ),
    figure(
      'Fast answers',
      shareNow === null ? '–' : `${shareNow}%`,
      shareThen === null ? null : `${shareThen}%`,
    ),
  ];
}

// What the trend says before there is anything to show: that it needs
// practice while there are no drills, then how far off a pace is. Null once
// there is a pace.
export function earlyLine(progress: Progress): string | null {
  if (progress.records.length === 0) {
    return 'A trend shows here once there is practice to compare.';
  }
  if (paceOf(progress.times) === null) {
    return `No pace yet: it starts after ${PACE_NEEDED} right answers (${progress.times.length} so far).`;
  }
  return null;
}

// The line under the trend that says what pace is.
export const PACE_NOTE = `Pace is the usual time to answer, typing included: the middle one of the last ${TIMES_KEPT} right answers.`;

// How many days back the chart reaches: twelve weeks, so that it stays
// readable as the history grows.
const CHART_DAYS = 84;

// How many drills need a pace before there is a line worth drawing.
const CHART_NEEDED = 5;

// The chart of pace drill by drill. Positions are fractions of the chart: x
// runs from the first charted day at 0 to today at 1, and y from zero to the
// highest pace at 1.
export type TrendChart = {
  points: { x: number; y: number }[];
  marks: { x: number; label: string }[];
  // The captions under the line: how far back it starts, in days under two
  // weeks and in weeks from there, and its highest value.
  span: string;
  highest: string;
};

// The chart over the last twelve weeks, or null until five drills in them
// have a pace and they span more than one day: drills are placed by their
// day, so one day's drills make no line.
export function trendChart(
  records: readonly DrillRecord[],
  dayOf: DayOf,
  today: Day,
): TrendChart | null {
  const dated = records.map((record) => ({
    record,
    daysAgo: today.ordinal - dayOf(record.at).ordinal,
  }));
  const charted = dated.flatMap(({ record: { pace }, daysAgo }) =>
    daysAgo >= 0 && daysAgo < CHART_DAYS && pace !== null
      ? [{ daysAgo, pace }]
      : [],
  );
  if (charted.length < CHART_NEEDED) return null;

  const top = Math.max(1, ...charted.map((point) => point.pace));
  const days = Math.max(...charted.map((point) => point.daysAgo));
  if (days === 0) return null;
  const xOf = (daysAgo: number) => 1 - daysAgo / days;

  // A mark where tables were switched on: wider tables push pace up, and the
  // mark says why. Only the days the line covers are marked.
  const marks = dated.flatMap(({ record, daysAgo }, index) => {
    const before = dated[index - 1]?.record;
    if (!before || daysAgo < 0 || daysAgo > days) return [];
    const added = record.tables.filter(
      (table) => !before.tables.includes(table),
    );
    return added.length === 0
      ? []
      : [{ x: xOf(daysAgo), label: `${tablesList(added)} added` }];
  });

  return {
    points: charted.map((point) => ({
      x: xOf(point.daysAgo),
      y: point.pace / top,
    })),
    marks,
    span: `${days < 14 ? counted(days, 'day') : counted(Math.round(days / 7), 'week')} ago`,
    highest: `highest ${seconds(top)}`,
  };
}

// The grid's columns: the multipliers 1 to 12.
export const GRID_COLUMNS: readonly number[] = Array.from(
  { length: 12 },
  (_, index) => index + 1,
);

// One cell of the fact grid: a multiplier of a table, shown as its product,
// coloured by its level and named by its fact and level so colour is not the
// only signal.
export type GridCell = {
  label: string;
  product: number;
  level: Level;
  counts: OutcomeCounts;
  ariaLabel: string;
};

export type GridRow = {
  label: string;
  cells: GridCell[];
};

// The fact grid, a multiplication square: one row per table, one cell per
// column. An overlap fact, such as 6 × 8, reads the same level from whichever
// row shows it.
export function gridRows(progress: Progress): GridRow[] {
  return TABLES.map((table) => ({
    label: `${table}s`,
    cells: GRID_COLUMNS.map((n) => {
      const key = factKey(table, n);
      const level = factLevel(progress, key);
      return {
        label: `${table} × ${n}`,
        product: table * n,
        level,
        counts: factCounts(progress, key),
        ariaLabel: `${table} × ${n}, level ${level}`,
      };
    }),
  }));
}

// A cell's lifetime counts, such as "6 × 7: fast 12, slow 3, missed 2".
export function countsLine(cell: GridCell): string {
  const { fast, slow, missed } = cell.counts;
  return `${cell.label}: fast ${fast}, slow ${slow}, missed ${missed}`;
}

// The grid's legend, from new or missed at level 0 to known at level 4.
export const LEGEND: readonly { level: Level; label: string }[] = [
  { level: 0, label: '0, new or missed' },
  { level: 1, label: '1' },
  { level: 2, label: '2' },
  { level: 3, label: '3' },
  { level: 4, label: '4, known' },
];
