import { FACTS, OFFERED_TABLES, TABLES, type Table } from './facts';
import { grade, type Level, type Outcome } from './level';
import { keepTime, TIME_CAP, TIMES_KEPT } from './pace';

// How many of each outcome, for one fact over its lifetime or for one drill.
export type OutcomeCounts = {
  fast: number;
  slow: number;
  missed: number;
};

// What the app remembers about one fact. An absent fact means level 0 with
// zero counts.
export type FactProgress = OutcomeCounts & {
  level: Level;
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

// The progress document, version 2: the whole of what the app stores.
// Everything beside the version belongs to the learner (ADR 0003).
export type Progress = {
  version: 2;
  // No repeats; may be empty.
  tables: Table[];
  facts: Record<string, FactProgress>;
  // The answer times that count towards pace (ADR 0002), oldest first.
  times: number[];
  records: DrillRecord[];
};

// The document for a first launch or a fresh start: the offered tables on
// and nothing learnt.
export function freshProgress(): Progress {
  return {
    version: 2,
    tables: [...OFFERED_TABLES],
    facts: {},
    times: [],
    records: [],
  };
}

const UNSEEN: FactProgress = { level: 0, fast: 0, slow: 0, missed: 0 };

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

// The document with one fact changed. The given document is left as it was.
function updateFact(
  progress: Progress,
  key: string,
  change: (before: FactProgress) => FactProgress,
): Progress {
  const after = change(progress.facts[key] ?? UNSEEN);
  return { ...progress, facts: { ...progress.facts, [key]: after } };
}

// The document after one outcome on a fact: its level moved and the
// outcome's lifetime count up by one.
export function applyOutcome(
  progress: Progress,
  key: string,
  outcome: Outcome,
): Progress {
  return updateFact(progress, key, (before) => ({
    ...before,
    level: grade(before.level, outcome),
    [outcome]: before[outcome] + 1,
  }));
}

// The document with one more answer time kept towards pace (ADR 0002). Only
// the times of right answers are ever passed.
export function keepAnswerTime(progress: Progress, time: number): Progress {
  return { ...progress, times: keepTime(progress.times, time) };
}

// The document with a record appended. The given document is left as it was.
export function addRecord(progress: Progress, record: DrillRecord): Progress {
  return { ...progress, records: [...progress.records, record] };
}

// Reads a stored document. Reading is strict: anything that is not a
// well-formed version 2 document, a version 1 document included, is corrupt
// and reads as null.
export function parseProgress(text: string): Progress | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return validateProgress(value);
}

// Checks a parsed value against the version 2 shape and its ranges, and
// rebuilds it from the known fields.
function validateProgress(value: unknown): Progress | null {
  if (!isObject(value)) return null;
  if (value.version !== 2) return null;
  const tables = validateTables(value.tables);
  const facts = validateFacts(value.facts);
  const times = validateTimes(value.times);
  const records = validateRecords(value.records);
  if (!tables || !facts || !times || !records) return null;
  return { version: 2, tables, facts, times, records };
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

function validateFacts(value: unknown): Record<string, FactProgress> | null {
  if (!isObject(value)) return null;
  const facts: Record<string, FactProgress> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!FACT_KEYS.has(key)) return null;
    if (!isObject(entry)) return null;
    const counts = validateCounts(entry);
    const { level } = entry;
    if (!counts || !isLevel(level)) return null;
    facts[key] = { ...counts, level };
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
