import { BONUS, fasterThanLastTime } from './bonus';
import {
  CATALOGUE,
  CROWN,
  isIdOf,
  isItemId,
  itemOf,
  SET,
  type ColourId,
  type HatId,
  type ItemId,
  type ThemeId,
} from './catalogue';
import {
  CHARACTERS,
  isCharacter,
  isUnlocked,
  newUnlocks,
  type Character,
} from './characters';
import { BAND_PAY, bandOf } from './drill';
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
const VERSION = 4;

// The progress document, version 4: the whole of what the app stores.
// Everything beside the version belongs to the learner (ADR 0003).
export type Progress = {
  version: typeof VERSION;
  // No repeats; may be empty.
  tables: Table[];
  facts: Record<string, FactProgress>;
  // The gems paid so far: at least the sum of every fact's highest level,
  // and more by the bonuses, band pay and badge pay. It never falls, and
  // the unlocks are read from it (ADR 0004, ADR 0005).
  earned: number;
  // What is left of earned after the purchases so far, from 0 to earned. It
  // is stored rather than worked out from the prices of what is owned, so
  // that a price change moves no balance (ADR 0005).
  balance: number;
  // The chosen character, one that earned has unlocked.
  character: Character;
  // The items bought or earned, without repeats. The crown is owned only
  // with every hat of the set.
  owned: ItemId[];
  // The worn hat, an owned one, or null for none.
  hat: HatId | null;
  // Each character's chosen colour: an owned variant of that character, or
  // null for its own.
  colours: Record<Character, ColourId | null>;
  // The chosen theme, an owned one, or null for the default.
  theme: ThemeId | null;
  // The finished drills done with each character.
  bond: Record<Character, number>;
  // The answer times that count towards pace (ADR 0002), oldest first.
  times: number[];
  records: DrillRecord[];
};

// A value per character, from an entry for each of the six.
function fromEntries<T>(entries: [Character, T][]): Record<Character, T> {
  return Object.fromEntries(entries) as Record<Character, T>;
}

// Every character with the same value.
function perCharacter<T>(value: T): Record<Character, T> {
  return fromEntries(CHARACTERS.map((character) => [character, value]));
}

// The document for a first launch or a fresh start: no table on, nothing
// learnt, no gems, nothing owned or worn, every bond at 0 and the dragon
// chosen.
export function freshProgress(): Progress {
  return {
    version: VERSION,
    tables: [],
    facts: {},
    earned: 0,
    balance: 0,
    character: 'dragon',
    owned: [],
    hat: null,
    colours: perCharacter(null),
    theme: null,
    bond: perCharacter(0),
    times: [],
    records: [],
  };
}

// The document with gems paid: earning adds to earned and the balance alike
// (ADR 0005).
function earn(progress: Progress, gems: number): Progress {
  return {
    ...progress,
    earned: progress.earned + gems,
    balance: progress.balance + gems,
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

// The gems a table's badge pays, at the answer that earns it (ADR 0005).
export const BADGE_PAY = 10;

// The tables with a badge, in table order: those whose every fact has a
// highest level of 4. A fact counts towards both of its tables. A badge is
// read from the highest levels, which never fall, so it is kept for good
// and never stored (ADR 0005).
export function badges(progress: Progress): Table[] {
  return TABLES.filter((table) =>
    pool([table]).every((fact) => progress.facts[fact.key]?.best === 4),
  );
}

// The document after one outcome on a fact: its level moved and the
// outcome's lifetime count up by one. A level the fact has not reached
// before becomes its highest level and pays one gem, to earned and the
// balance, and each table that it completes earns its badge and pays 10
// more; only a fast outcome raises a level, so nothing else pays. Both are
// paid at the answer, so that a drill left without a record loses none of
// them (ADR 0004, ADR 0005). The given document is left as it was.
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
  const moved = { ...progress, facts: { ...progress.facts, [key]: after } };
  if (!firstTime) return moved;
  const completed = badges(moved).length - badges(progress).length;
  return earn(moved, 1 + completed * BADGE_PAY);
}

// The document with the given character chosen, when earned has unlocked
// it; a locked character leaves the choice as it was. The given document is
// left as it was.
export function chooseCharacter(
  progress: Progress,
  character: Character,
): Progress {
  if (!isUnlocked(character, progress.earned)) return progress;
  return { ...progress, character };
}

// The document with an item bought: its price off the balance and its id
// added to what is owned. Earned is left alone, so nothing unlocked is lost
// (ADR 0005). Owning the sixth hat of the set adds the crown in the same
// step. A balance short of the price, an item owned already and the crown,
// which has no price, leave the document as it was. The given document is
// left as it was.
export function buy(progress: Progress, id: ItemId): Progress {
  const { price } = itemOf(id);
  if (price === null || price > progress.balance) return progress;
  if (progress.owned.includes(id)) return progress;
  const owned = [...progress.owned, id];
  const setDone = SET.every((hat) => owned.includes(hat));
  if (setDone && !owned.includes(CROWN)) owned.push(CROWN);
  return { ...progress, balance: progress.balance - price, owned };
}

// The owned hats, in catalogue order, which puts the crown last.
export function ownedHats(progress: Progress): HatId[] {
  return CATALOGUE.flatMap((item) =>
    item.kind === 'hat' && progress.owned.includes(item.id) ? [item.id] : [],
  );
}

// The document with the given hat worn, when it is owned, or with none worn
// for null; a hat not owned leaves the choice as it was. The given document
// is left as it was.
export function chooseHat(progress: Progress, hat: HatId | null): Progress {
  if (hat !== null && !progress.owned.includes(hat)) return progress;
  return { ...progress, hat };
}

// The document with one more answer time kept towards pace (ADR 0002). Only
// the times of right answers are ever passed.
export function keepAnswerTime(progress: Progress, time: number): Progress {
  return { ...progress, times: keepTime(progress.times, time) };
}

// What recording a drill paid and why, which the end screen shows: whether
// the drill was faster than last time, which pays the bonus (ADR 0004), and
// the band pay; and what the drill brought: the tables whose badges its
// answers earned, and the characters its gems unlocked, in unlock order
// (ADR 0005).
export type Recorded = {
  progress: Progress;
  faster: boolean;
  bandPay: number;
  newBadges: Table[];
  unlocks: Character[];
};

// The document with a record appended, the bonus paid if the drill was
// faster than last time, band pay paid by the drill's band and one more
// drill on the chosen character's bond, with what was paid. A quit drill is
// in the low band, pays neither and adds nothing to the bond. The badges
// and unlocks are read between the document as the drill began and the one
// after all of it was paid, so a badge or character a migration or an
// earlier drill brought is never announced. The badges were paid at the
// answers that earned them. The given documents are left as they were.
export function recordDrill(
  progress: Progress,
  record: DrillRecord,
  started: Progress,
): Recorded {
  const faster = fasterThanLastTime(progress.records, record);
  const bandPay = BAND_PAY[bandOf(record)];
  const badgedAtStart = badges(started);
  const { character, bond } = progress;
  const withRecord = {
    ...progress,
    records: [...progress.records, record],
    bond: record.quit ? bond : { ...bond, [character]: bond[character] + 1 },
  };
  const paid = earn(withRecord, (faster ? BONUS : 0) + bandPay);
  return {
    progress: paid,
    faster,
    bandPay,
    newBadges: badges(paid).filter((table) => !badgedAtStart.includes(table)),
    unlocks: newUnlocks(started.earned, paid.earned),
  };
}

// What a stored document reads as: a version 4 document, migrated or not;
// corrupt; or newer than this build knows.
export type ProgressRead =
  | { kind: 'read'; progress: Progress; migrated: boolean }
  | { kind: 'corrupt' }
  | { kind: 'newer' };

// The one version there is a migration from.
const MIGRATES_FROM = 3;

// Reads a stored document. Reading is strict: a well-formed version 4
// document is read and a well-formed version 3 document is migrated
// (ADR 0005). A whole-number version above 4 is a newer build's document,
// which this build cannot judge. Anything else, a version 1 or 2 document
// included, is corrupt.
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
// rebuilds it as a version 4 document from the known fields. A version 3
// document holds its gems in place of earned and the balance, and nothing
// of the Shop's: both are set from its gems, and it is given a fresh
// document's items, colours, theme and bond.
function validateProgress(
  value: Record<string, unknown>,
  version: typeof VERSION | typeof MIGRATES_FROM,
): Progress | null {
  const tables = validateTables(value.tables);
  const facts = validateFacts(value.facts);
  const times = validateTimes(value.times);
  const records = validateRecords(value.records);
  if (!tables || !facts || !times || !records) return null;
  const paid = Object.values(facts).reduce((sum, fact) => sum + fact.best, 0);
  const earned = version === MIGRATES_FROM ? value.gems : value.earned;
  const { character } = value;
  if (!isCount(earned) || earned < paid) return null;
  if (!isCharacter(character) || !isUnlocked(character, earned)) return null;
  const learner = { tables, facts, earned, character, times, records };
  if (version === MIGRATES_FROM) {
    return { ...freshProgress(), ...learner, balance: earned };
  }
  const shop = validateShop(value, earned);
  if (!shop) return null;
  return { version: VERSION, ...learner, ...shop };
}

// The version 4 fields of the Shop and the bond, checked against the
// catalogue and against what is owned.
function validateShop(
  value: Record<string, unknown>,
  earned: number,
): Pick<
  Progress,
  'balance' | 'owned' | 'hat' | 'colours' | 'theme' | 'bond'
> | null {
  const { balance } = value;
  if (!isCount(balance) || balance > earned) return null;
  const owned = validateOwned(value.owned);
  if (!owned) return null;
  const hat = validateChoice(value.hat, (id) => isIdOf(id, 'hat'), owned);
  const theme = validateChoice(value.theme, (id) => isIdOf(id, 'theme'), owned);
  if (hat === undefined || theme === undefined) return null;
  const colours = validatePerCharacter(
    value.colours,
    (colour, character): colour is ColourId | null => {
      if (colour === null) return true;
      if (!isIdOf(colour, 'colour') || !owned.includes(colour)) return false;
      const item = itemOf(colour);
      return item.kind === 'colour' && item.character === character;
    },
  );
  const bond = validatePerCharacter(value.bond, isCount);
  if (!colours || !bond) return null;
  return { balance, owned, hat, colours, theme, bond };
}

// Owned item ids: in the catalogue, without repeats, and the crown only
// with the whole set.
function validateOwned(value: unknown): ItemId[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isItemId)) return null;
  if (new Set(value).size !== value.length) return null;
  if (value.includes(CROWN) && !SET.every((hat) => value.includes(hat))) {
    return null;
  }
  return [...value];
}

// A choice among the owned items of one kind: an owned item's id, or null
// for none of them. Undefined when the value is neither.
function validateChoice<T extends ItemId>(
  value: unknown,
  ofKind: (id: unknown) => id is T,
  owned: readonly ItemId[],
): T | null | undefined {
  if (value === null) return null;
  if (ofKind(value) && owned.includes(value)) return value;
  return undefined;
}

// A value per character: an object with a key for every character and no
// other, each value passing the check.
function validatePerCharacter<T>(
  value: unknown,
  check: (entry: unknown, character: Character) => entry is T,
): Record<Character, T> | null {
  if (!isObject(value)) return null;
  if (!Object.keys(value).every(isCharacter)) return null;
  const entries: [Character, T][] = [];
  for (const character of CHARACTERS) {
    const entry = value[character];
    if (!check(entry, character)) return null;
    entries.push([character, entry]);
  }
  return fromEntries(entries);
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
    const { best } = entry;
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
