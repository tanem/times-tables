import { FACTS, TABLES, type Table } from './facts';
import { grade, type GotOutcome, type Level, type Outcome } from './level';

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

// The one entry a drill leaves behind. The speed run is gone, but the
// version 1 shape is unchanged: a stored speed run record still reads as
// valid and nothing uses it, and a drill's record carries a null time.
export type DrillRecord = OutcomeCounts & {
  mode: 'drill' | 'speed';
  at: string;
  tables: Table[];
  quit: boolean;
  time: number | null;
};

// The progress document, version 1: the whole of what the app stores.
export type Progress = {
  version: 1;
  tables: Table[];
  facts: Record<string, FactProgress>;
  records: DrillRecord[];
};

// The document for a first launch or a fresh start: all three tables on and
// nothing learnt.
export function freshProgress(): Progress {
  return { version: 1, tables: [...TABLES], facts: {}, records: [] };
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

// The document after a got outcome on a fact is corrected to missed: that
// outcome's count goes back down, the missed count goes up and the level
// goes to 0. The outcome must be the one just applied to the fact.
export function correctOutcome(
  progress: Progress,
  key: string,
  outcome: GotOutcome,
): Progress {
  return updateFact(progress, key, (before) => ({
    ...before,
    level: grade(before.level, 'missed'),
    [outcome]: before[outcome] - 1,
    missed: before.missed + 1,
  }));
}

// The document with a record appended. The given document is left as it was.
export function addRecord(progress: Progress, record: DrillRecord): Progress {
  return { ...progress, records: [...progress.records, record] };
}

// Reads a stored document. Reading is strict: anything that is not a
// well-formed version 1 document is corrupt and reads as null.
export function parseProgress(text: string): Progress | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return validateProgress(value);
}

// Checks a parsed value against the version 1 shape and its ranges, and
// rebuilds it from the known fields.
function validateProgress(value: unknown): Progress | null {
  if (!isObject(value)) return null;
  if (value.version !== 1) return null;
  const tables = validateTables(value.tables);
  const facts = validateFacts(value.facts);
  const records = validateRecords(value.records);
  if (!tables || !facts || !records) return null;
  return { version: 1, tables, facts, records };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
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
  const { mode, at, tables, quit, time } = value;
  if (mode !== 'drill' && mode !== 'speed') return null;
  if (typeof at !== 'string') return null;
  const validTables = validateTables(tables);
  const counts = validateCounts(value);
  if (!validTables || !counts) return null;
  if (typeof quit !== 'boolean') return null;
  if (time !== null && !isCount(time)) return null;
  return { ...counts, mode, at, tables: validTables, quit, time };
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
