import { BONUS, fasterThanLastTime } from './bonus';
import { isCharacter, isUnlocked, type Character } from './characters';
import { FACTS, pool, TABLES, type Table } from './facts';
import { grade, type Level, type Outcome } from './level';
import { keepTime, TIME_CAP, TIMES_KEPT } from './pace';

// How many of each outcome, for one fact over its lifetime or for one drill.
export type OutcomeCounts = {
  fast: number;
  slow: number;
  missed: number;
};

// What the app remembers about one fact. An absent fact means level 0, a
// highest level of 0 and zero counts.
export type FactProgress = OutcomeCounts & {
  level: Level;
  // The highest level the fact has reached, which never falls. Each level it
  // reaches for the first time pays a gem (ADR 0004).
  best: Level;
};

// The one entry a drill leaves behind. A quit drill holds the same values as
// they stood when it was quit.
export type DrillRecord = OutcomeCounts & {
  at: string;
  tables: Table[];
  quit: boolean;
  // The pace at the end of the drill, in whole milliseconds under the cap,
  // or null while there is no pace.
  pace: number | null;
  // The number of facts at level 4 at the end of the drill.
  known: number;
  // The median answer time of the drill's right answers under the cap, in
  // whole milliseconds, or null when there are none.
  median: number | null;
};

// The version of the document this build reads and writes.
const VERSION = 3;

// The progress document, version 3: the whole of what the app stores.
// Everything beside the version belongs to the learner (ADR 0003).
export type Progress = {
  version: typeof VERSION;
  // No repeats; may be empty.
  tables: Table[];
  facts: Record<string, FactProgress>;
  // The gems paid so far: at least the sum of every fact's highest level,
  // and more by the bonuses. The total never falls (ADR 0004).
  gems: number;
  // The chosen character, one that the gems have unlocked.
  character: Character;
  // The answer times that count towards pace (ADR 0002), oldest first.
  times: number[];
  records: DrillRecord[];
};

// The document for a first launch or a fresh start: no table on, nothing
// learnt, no gems and the dragon chosen.
export function freshProgress(): Progress {
  return {
    version: VERSION,
    tables: [],
    facts: {},
    gems: 0,
    character: 'dragon',
    times: [],
    records: [],
  };
}

const UNSEEN: FactProgress = { level: 0, best: 0, fast: 0, slow: 0, missed: 0 };

// The level of a fact; an absent fact is at level 0.
export function factLevel(progress: Progress, key: string): Level {
  return (progress.facts[key] ?? UNSEEN).level;
}

// A fact's lifetime outcome counts; an absent fact has none.
export function factCounts(progress: Progress, key: string): OutcomeCounts {
  const { fast, slow, missed } = progress.facts[key] ?? UNSEEN;
  return { fast, slow, missed };
}

// The number of facts at level 4.
export function knownCount(progress: Progress): number {
  return Object.values(progress.facts).filter((fact) => fact.level === 4)
    .length;
}

// The share of a table's facts at level 4, from 0 to 1. A fact counts towards
// both of its tables, so a table that was never switched on still shows the
// facts known through the others.
export function knownShare(progress: Progress, table: Table): number {
  const facts = pool([table]);
  const known = facts.filter((fact) => factLevel(progress, fact.key) === 4);
  return known.length / facts.length;
}

// The document after one outcome on a fact: its level moved and the
// outcome's lifetime count up by one. A level the fact has not reached
// before becomes its highest level and pays one gem; only a fast outcome
// raises a level, so nothing else pays. The given document is left as it
// was.
export function applyOutcome(
  progress: Progress,
  key: string,
  outcome: Outcome,
): Progress {
  const before = progress.facts[key] ?? UNSEEN;
  const level = grade(before.level, outcome);
  const firstTime = level > before.best;
  const after: FactProgress = {
    ...before,
    level,
    best: firstTime ? level : before.best,
    [outcome]: before[outcome] + 1,
  };
  return {
    ...progress,
    facts: { ...progress.facts, [key]: after },
    gems: progress.gems + (firstTime ? 1 : 0),
  };
}

// The document with one more answer time kept towards pace (ADR 0002). Only
// the times of right answers are ever passed.
export function keepAnswerTime(progress: Progress, time: number): Progress {
  return { ...progress, times: keepTime(progress.times, time) };
}

// The document with a record appended and the bonus paid if the drill was
// faster than last time, with the verdict it was paid on, which the end
// screen shows (ADR 0004). The given document is left as it was.
export function recordDrill(
  progress: Progress,
  record: DrillRecord,
): { progress: Progress; faster: boolean } {
  const faster = fasterThanLastTime(progress.records, record);
  return {
    progress: {
      ...progress,
      gems: progress.gems + (faster ? BONUS : 0),
      records: [...progress.records, record],
    },
    faster,
  };
}

// What a stored document reads as: a version 3 document, migrated or not;
// corrupt; or newer than this build knows.
export type ProgressRead =
  | { kind: 'read'; progress: Progress; migrated: boolean }
  | { kind: 'corrupt' }
  | { kind: 'newer' };

// The one version there is a migration from.
const MIGRATES_FROM = 2;

// Reads a stored document. Reading is strict: a well-formed version 3
// document is read and a well-formed version 2 document is migrated
// (ADR 0004). A whole-number version above 3 is a newer build's
// document, which this build cannot judge. Anything else, a version 1
// document included, is corrupt.
export function parseProgress(text: string): ProgressRead {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: 'corrupt' };
  }
  if (!isObject(value)) return { kind: 'corrupt' };
  const { version } = value;
  if (isCount(version) && version > VERSION) return { kind: 'newer' };
  if (version !== VERSION && version !== MIGRATES_FROM) {
    return { kind: 'corrupt' };
  }
  const progress = validateProgress(value, version);
  if (!progress) return { kind: 'corrupt' };
  return { kind: 'read', progress, migrated: version === MIGRATES_FROM };
}

// Checks a parsed value against the shape and ranges of its version, and
// rebuilds it as a version 3 document from the known fields. A version 2
// document has no gems, character or highest levels, and is given them: each
// fact's highest level is its level now, the gems are the sum of those and
// the dragon is chosen.
function validateProgress(
  value: Record<string, unknown>,
  version: typeof VERSION | typeof MIGRATES_FROM,
): Progress | null {
  const migrating = version === MIGRATES_FROM;
  const tables = validateTables(value.tables);
  const facts = validateFacts(value.facts, migrating);
  const times = validateTimes(value.times);
  const records = validateRecords(value.records);
  if (!tables || !facts || !times || !records) return null;
  const paid = Object.values(facts).reduce((sum, fact) => sum + fact.best, 0);
  const gems = migrating ? paid : value.gems;
  const character = migrating ? 'dragon' : value.character;
  if (!isCount(gems) || gems < paid) return null;
  if (!isCharacter(character) || !isUnlocked(character, gems)) return null;
  return { version: VERSION, tables, facts, gems, character, times, records };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

// A whole number of milliseconds from 0 to under the cap: an answer time, or
// a median of answer times rounded to the nearest whole number.
function isTime(value: unknown): value is number {
  return isCount(value) && value < TIME_CAP;
}

function isTable(value: unknown): value is Table {
  return (TABLES as readonly number[]).includes(value as number);
}

function isLevel(value: unknown): value is FactProgress['level'] {
  return (
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 4
  );
}

const FACT_KEYS = new Set(FACTS.map((fact) => fact.key));

function validateCounts(value: Record<string, unknown>): OutcomeCounts | null {
  const { fast, slow, missed } = value;
  if (!isCount(fast) || !isCount(slow) || !isCount(missed)) return null;
  return { fast, slow, missed };
}

function validateTables(value: unknown): Table[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isTable)) return null;
  if (new Set(value).size !== value.length) return null;
  return [...value];
}

function validateTimes(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > TIMES_KEPT) return null;
  if (!value.every(isTime)) return null;
  return [...value];
}

// A fact of a document being migrated has no highest level, and takes its
// level now.
function validateFacts(
  value: unknown,
  migrating: boolean,
): Record<string, FactProgress> | null {
  if (!isObject(value)) return null;
  const facts: Record<string, FactProgress> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!FACT_KEYS.has(key)) return null;
    if (!isObject(entry)) return null;
    const counts = validateCounts(entry);
    const { level } = entry;
    if (!counts || !isLevel(level)) return null;
    const best = migrating ? level : entry.best;
    if (!isLevel(best) || best < level) return null;
    facts[key] = { ...counts, level, best };
  }
  return facts;
}

function validateRecord(value: unknown): DrillRecord | null {
  if (!isObject(value)) return null;
  const { at, tables, quit, pace, known, median } = value;
  if (typeof at !== 'string') return null;
  const validTables = validateTables(tables);
  const counts = validateCounts(value);
  if (!validTables || !counts) return null;
  if (typeof quit !== 'boolean') return null;
  if (pace !== null && !isTime(pace)) return null;
  if (!isCount(known) || known > FACTS.length) return null;
  if (median !== null && !isTime(median)) return null;
  return { ...counts, at, tables: validTables, quit, pace, known, median };
}

function validateRecords(value: unknown): DrillRecord[] | null {
  if (!Array.isArray(value)) return null;
  const records: DrillRecord[] = [];
  for (const entry of value) {
    const record = validateRecord(entry);
    if (!record) return null;
    records.push(record);
  }
  return records;
}
