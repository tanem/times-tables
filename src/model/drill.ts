import { pool, type Fact, type Table } from './facts';
import { weightOf, type Level, type Outcome } from './level';
import type { DrillRecord, OutcomeCounts } from './progress';

// The number of presentations in a drill.
export const DRILL_LENGTH = 20;

// How many of the facts last shown a draw keeps out.
const RECENT_LENGTH = 3;

// The level of a fact by its key, as the progress document has it.
export type LevelOf = (key: string) => Level;

// A source of numbers in [0, 1), the random module or a test's stand-in.
export type Random = () => number;

// One showing of a fact, in the ordering it is shown in: x × y.
export type Presentation = {
  readonly fact: Fact;
  readonly x: number;
  readonly y: number;
};

// The answer given to the current presentation, with the streak and best
// streak as they were before it, so that a correction can undo it.
export type Answer = {
  readonly outcome: Outcome;
  readonly streak: number;
  readonly bestStreak: number;
};

// One sitting of practice. Every function here returns a new drill and
// leaves the given one as it was.
export type Drill = Readonly<OutcomeCounts> & {
  readonly tables: Table[];
  readonly pool: readonly Fact[];
  // The presentation on the card, or the one just answered.
  readonly current: Presentation;
  // The answer to the current presentation, or null while it is on the card.
  readonly last: Answer | null;
  readonly answered: number;
  // Consecutive fast outcomes, and the longest run of them in this drill.
  readonly streak: number;
  readonly bestStreak: number;
  // The keys of the last facts shown, oldest first.
  readonly recent: readonly string[];
  readonly quit: boolean;
};

// A weighted random draw from the pool, skipping the facts shown last.
export function drawFact(
  candidates: readonly Fact[],
  recent: readonly string[],
  levelOf: LevelOf,
  random: Random,
): Fact {
  const eligible = candidates.filter((fact) => !recent.includes(fact.key));
  const total = eligible.reduce(
    (sum, fact) => sum + weightOf(levelOf(fact.key)),
    0,
  );
  let r = random() * total;
  for (const fact of eligible) {
    r -= weightOf(levelOf(fact.key));
    if (r < 0) return fact;
  }
  // Rounding can leave r at 0 after the last fact; that fact is the draw.
  const last = eligible.at(-1);
  if (!last) throw new Error('the pool has no fact to draw');
  return last;
}

// A drawn fact in one of its two orderings, chosen at random.
function presentation(fact: Fact, random: Random): Presentation {
  return random() < 0.5
    ? { fact, x: fact.a, y: fact.b }
    : { fact, x: fact.b, y: fact.a };
}

// A new drill on the given tables, with its first fact drawn.
export function startDrill(
  tables: readonly Table[],
  levelOf: LevelOf,
  random: Random,
): Drill {
  const drill: Omit<Drill, 'current'> = {
    tables: [...tables],
    pool: pool(tables),
    answered: 0,
    fast: 0,
    slow: 0,
    missed: 0,
    streak: 0,
    bestStreak: 0,
    recent: [],
    last: null,
    quit: false,
  };
  return { ...drill, current: draw(drill, levelOf, random) };
}

function draw(
  drill: Omit<Drill, 'current'>,
  levelOf: LevelOf,
  random: Random,
): Presentation {
  const fact = drawFact(drill.pool, drill.recent, levelOf, random);
  return presentation(fact, random);
}

// The drill with the next fact drawn and on the card. The levels are read
// afresh so that the answer just given weighs on the draw.
export function present(drill: Drill, levelOf: LevelOf, random: Random): Drill {
  return { ...drill, current: draw(drill, levelOf, random), last: null };
}

// The drill after the learner's outcome on the current presentation: the
// tally, the streak and the recent facts move on. The presentation stays
// current until the next one is drawn.
export function answer(drill: Drill, outcome: Outcome): Drill {
  const streak = outcome === 'fast' ? drill.streak + 1 : 0;
  return {
    ...drill,
    [outcome]: drill[outcome] + 1,
    answered: drill.answered + 1,
    streak,
    bestStreak: Math.max(drill.bestStreak, streak),
    recent: [...drill.recent, drill.current.fact.key].slice(-RECENT_LENGTH),
    last: { outcome, streak: drill.streak, bestStreak: drill.bestStreak },
  };
}

// The drill with the answer to the current presentation re-graded as
// missed: the tally moves from the outcome given to missed, the best streak
// goes back to what it was before the answer, and the streak resets. Only a
// fast or slow answer can be corrected.
export function correct(drill: Drill): Drill {
  const { last } = drill;
  if (!last || last.outcome === 'missed') {
    throw new Error('there is no fast or slow answer to correct');
  }
  return {
    ...drill,
    [last.outcome]: drill[last.outcome] - 1,
    missed: drill.missed + 1,
    streak: 0,
    bestStreak: last.bestStreak,
    last: { ...last, outcome: 'missed' },
  };
}

// The drill stopped early, keeping every answer given so far.
export function quitDrill(drill: Drill): Drill {
  return { ...drill, quit: true };
}

// Whether the drill has ended, by running its length or by a quit.
export function isComplete(drill: Drill): boolean {
  return drill.quit || drill.answered >= DRILL_LENGTH;
}

// The entry the drill leaves in the progress, timestamped with when it
// ended.
export function drillRecord(drill: Drill, at: string): DrillRecord {
  return {
    mode: 'drill',
    at,
    tables: [...drill.tables],
    fast: drill.fast,
    slow: drill.slow,
    missed: drill.missed,
    quit: drill.quit,
    time: null,
  };
}
