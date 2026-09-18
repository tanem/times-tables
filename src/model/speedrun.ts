import { presentation, type Presentation, type Random } from './drill';
import { FACTS, TABLES, type Fact } from './facts';
import type { Outcome } from './level';
import type { CompletedRun, DrillRecord, OutcomeCounts } from './progress';

// One speed run. Every function here returns a new run and leaves the given
// one as it was.
export type SpeedRun = Readonly<OutcomeCounts> & {
  // The presentations still to be got, the one on the card first. Empty
  // once every fact has been got.
  readonly queue: readonly Presentation[];
};

// The facts in a random order, each order as likely as another.
function shuffled(facts: readonly Fact[], random: Random): Fact[] {
  const result = [...facts];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const [atI, atJ] = [result[i], result[j]];
    if (atI === undefined || atJ === undefined) continue;
    result[i] = atJ;
    result[j] = atI;
  }
  return result;
}

// A new run: every fact, whatever tables are chosen, shuffled into a queue,
// each in a random ordering.
export function startRun(random: Random): SpeedRun {
  return {
    queue: shuffled(FACTS, random).map((fact) => presentation(fact, random)),
    fast: 0,
    slow: 0,
    missed: 0,
  };
}

// The presentation on the card.
export function cardOf(run: SpeedRun): Presentation {
  const [card] = run.queue;
  if (!card) throw new Error('the run has no fact left to show');
  return card;
}

// The run after the outcome on the card: the tally moves on and the fact
// leaves the queue. A missed fact goes to the back of the queue in a fresh
// random ordering, which is the front when nothing else is left.
export function answerRun(
  run: SpeedRun,
  outcome: Outcome,
  random: Random,
): SpeedRun {
  const { fact } = cardOf(run);
  const rest = run.queue.slice(1);
  return {
    ...run,
    [outcome]: run[outcome] + 1,
    queue: outcome === 'missed' ? [...rest, presentation(fact, random)] : rest,
  };
}

// Whether every fact has been got.
export function isRunComplete(run: SpeedRun): boolean {
  return run.queue.length === 0;
}

// The entry the run leaves in the progress, timestamped with when it ended.
// The time is the clock at the last fact got, in milliseconds and stored
// whole; a run that was quit has none, and null records it as quit.
export function speedRunRecord(
  run: SpeedRun,
  at: string,
  time: number,
): CompletedRun;
export function speedRunRecord(
  run: SpeedRun,
  at: string,
  time: null,
): DrillRecord;
export function speedRunRecord(
  run: SpeedRun,
  at: string,
  time: number | null,
): DrillRecord {
  if (time !== null && !isRunComplete(run)) {
    throw new Error('only a completed run has a time');
  }
  return {
    mode: 'speed',
    at,
    tables: [...TABLES],
    fast: run.fast,
    slow: run.slow,
    missed: run.missed,
    quit: time === null,
    time: time === null ? null : Math.round(time),
  };
}

const TENTH = 100;

// A time as minutes, seconds and tenths, such as 2:41.3. The tenths are cut
// short, not rounded, so that a running clock never shows a time it has not
// reached.
export function formatTime(ms: number): string {
  const tenths = Math.floor(ms / TENTH);
  const minutes = Math.floor(tenths / 600);
  const seconds = String(Math.floor(tenths / 10) % 60).padStart(2, '0');
  return `${minutes}:${seconds}.${tenths % 10}`;
}

// How far a time is behind the best, in seconds and tenths, such as 2.4 s.
// It is the gap between the two times as formatTime shows them.
export function formatGap(time: number, best: number): string {
  const tenths = Math.floor(time / TENTH) - Math.floor(best / TENTH);
  return `${(tenths / 10).toFixed(1)} s`;
}
