import { FACTS, TABLES, type Table } from './facts';

// What the app remembers about one fact. An absent fact means level 0 with
// zero counts.
export type FactProgress = {
  level: 0 | 1 | 2 | 3 | 4;
  fast: number;
  slow: number;
  missed: number;
};

// The one entry a drill or speed run leaves behind.
export type DrillRecord = {
  mode: 'drill' | 'speed';
  at: string;
  tables: Table[];
  fast: number;
  slow: number;
  missed: number;
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
export function validateProgress(value: unknown): Progress | null {
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
    const { level, fast, slow, missed } = entry;
    if (!isLevel(level)) return null;
    if (!isCount(fast) || !isCount(slow) || !isCount(missed)) return null;
    facts[key] = { level, fast, slow, missed };
  }
  return facts;
}

function validateRecord(value: unknown): DrillRecord | null {
  if (!isObject(value)) return null;
  const { mode, at, tables, fast, slow, missed, quit, time } = value;
  if (mode !== 'drill' && mode !== 'speed') return null;
  if (typeof at !== 'string') return null;
  const validTables = validateTables(tables);
  if (!validTables) return null;
  if (!isCount(fast) || !isCount(slow) || !isCount(missed)) return null;
  if (typeof quit !== 'boolean') return null;
  if (time !== null && !isCount(time)) return null;
  return { mode, at, tables: validTables, fast, slow, missed, quit, time };
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
