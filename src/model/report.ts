// The Parent view's model: pure functions from a Progress document and
// calendar days to the strings and data the screen shows. No clock, no DOM.

import { DRILL_LENGTH } from './drill';
import { factKey, TABLES, type Table } from './facts';
import type { Level } from './level';
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

// The drills among the records. A version 1 document can still hold speed
// run records from before the speed run was removed; they stay stored and
// nothing reads them.
function drillsOf(records: readonly DrillRecord[]): DrillRecord[] {
  return records.filter((record) => record.mode === 'drill');
}

// This calendar week's practice: how many drills (a quit drill counts as a
// drill), how many facts were answered across them, and what share of those
// were fast. "No practice this week" when there are none.
export function weekLine(
  records: readonly DrillRecord[],
  dayOf: DayOf,
  today: Day,
): string {
  const week = drillsOf(records).filter((record) =>
    inWeek(dayOf(record.at), today),
  );
  if (week.length === 0) return 'No practice this week';

  const totalAnswered = week.reduce((sum, record) => sum + answered(record), 0);
  const fast = week.reduce((sum, record) => sum + record.fast, 0);

  const line = `This week: ${counted(week.length, 'drill')}, ${counted(totalAnswered, 'fact')} answered`;
  if (totalAnswered === 0) return line;
  const share = Math.round((fast / totalAnswered) * 100);
  return `${line}, ${share}% fast`;
}

// The tables a record covers, listed with "and" before the last: "6s", "6s
// and 8s", "6s, 8s and 12s".
function tablesWording(tables: readonly Table[]): string {
  const names = tables.map((table) => `${table}s`);
  const last = names.at(-1) ?? '';
  return names.length < 2
    ? last
    : `${names.slice(0, -1).join(', ')} and ${last}`;
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
  return drillsOf(records)
    .slice(-10)
    .reverse()
    .map((record) => drillRow(record, dayOf(record.at), today));
}

// One cell of the fact grid: a multiplier of a table, shown as the fact
// itself, coloured and named by its level so colour is not the only signal.
export type GridCell = {
  label: string;
  level: Level;
  counts: OutcomeCounts;
  ariaLabel: string;
};

export type GridRow = {
  label: string;
  cells: GridCell[];
};

// The fact grid: one row per table, twelve cells for the multipliers 1 to
// 12. An overlap fact, such as 6 × 8, reads the same level from whichever
// row shows it.
export function gridRows(progress: Progress): GridRow[] {
  return TABLES.map((table) => ({
    label: `${table}s`,
    cells: Array.from({ length: 12 }, (_, index) => {
      const n = index + 1;
      const key = factKey(table, n);
      const level = factLevel(progress, key);
      return {
        label: `${table} × ${n}`,
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
