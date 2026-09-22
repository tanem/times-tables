import type { Table } from './facts';
import type { DrillRecord } from './progress';

// The gems a drill faster than last time pays (ADR 0004).
export const BONUS = 2;

// How many right answers each of the two drills needs for the comparison to
// mean anything.
export const RIGHT_NEEDED = 10;

// Whether two drills were on the same tables. The tables hold no repeats, so
// the same count and every table in common is the same set, in any order.
function sameTables(a: readonly Table[], b: readonly Table[]): boolean {
  return a.length === b.length && a.every((table) => b.includes(table));
}

// Whether a drill has a median and enough right answers to be compared. The
// right answers are the fast and slow counts.
function comparable(
  record: DrillRecord,
): record is DrillRecord & { median: number } {
  return record.median !== null && record.fast + record.slow >= RIGHT_NEEDED;
}

// Whether a drill was faster than last time, which pays the bonus (ADR
// 0004). The records are the ones before this drill, oldest first. Last time
// is the most recent of them that was finished on the same tables, in any
// order and however long ago; a quit drill and a drill on other tables are
// skipped over. Nothing further back is looked at, because "Faster than last
// time!" has to be true of the drill it names, so a last time with no median
// or too few right answers pays nothing. A tie does not pay, and a quit drill
// is never paid.
export function fasterThanLastTime(
  records: readonly DrillRecord[],
  record: DrillRecord,
): boolean {
  if (record.quit || !comparable(record)) return false;
  const last = records.findLast(
    (earlier) => !earlier.quit && sameTables(earlier.tables, record.tables),
  );
  if (!last || !comparable(last)) return false;
  return record.median < last.median;
}
