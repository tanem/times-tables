import { describe, expect, it } from 'vitest';
import {
  addRecord,
  applyOutcome,
  factCounts,
  factLevel,
  freshProgress,
  keepAnswerTime,
  knownCount,
  knownShare,
  parseProgress,
  type DrillRecord,
  type Progress,
  type ProgressRead,
} from './progress';

const valid: Progress = {
  version: 3,
  tables: [6, 12],
  facts: {
    '6x7': { level: 3, best: 4, fast: 12, slow: 3, missed: 2 },
    '8x12': { level: 0, best: 1, fast: 1, slow: 0, missed: 1 },
  },
  // The 5 the facts have paid, and 22 in bonuses.
  gems: 27,
  character: 'cat',
  times: [2400, 0, 19999],
  records: [
    {
      at: '2026-01-01T09:00:00.000Z',
      tables: [6, 12],
      fast: 14,
      slow: 4,
      missed: 2,
      quit: false,
      pace: null,
      known: 0,
      median: null,
    },
    {
      at: '2026-01-02T09:00:00.000Z',
      tables: [6, 8, 12],
      fast: 16,
      slow: 2,
      missed: 2,
      quit: false,
      pace: 2400,
      known: 77,
      median: 19999,
    },
  ],
};

// What parseProgress makes of a parsed document.
function read(document: unknown): ProgressRead {
  return parseProgress(JSON.stringify(document));
}

// A version 3 document read as it is.
function asRead(progress: unknown): unknown {
  return { kind: 'read', progress, migrated: false };
}

const CORRUPT = { kind: 'corrupt' };

// The valid document holding one drill record, with some of the record's
// fields replaced.
function withRecord(fields: Record<string, unknown>): unknown {
  return { ...valid, records: [{ ...valid.records[1], ...fields }] };
}

describe('freshProgress', () => {
  it('starts at version 3 with no table on, nothing learnt, no gems and the dragon', () => {
    expect(freshProgress()).toEqual({
      version: 3,
      tables: [],
      facts: {},
      gems: 0,
      character: 'dragon',
      times: [],
      records: [],
    });
  });

  it('gives each caller its own document', () => {
    const first = freshProgress();
    first.tables.push(6);
    expect(freshProgress().tables).toEqual([]);
  });
});

describe('parseProgress', () => {
  it('reads back a valid document', () => {
    expect(read(valid)).toEqual(asRead(valid));
  });

  it('reads a document with no tables on', () => {
    expect(read({ ...valid, tables: [] })).toEqual(
      asRead({ ...valid, tables: [] }),
    );
  });

  it('reads a document with all eleven tables on', () => {
    const tables = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(read({ ...valid, tables })).toEqual(asRead({ ...valid, tables }));
  });

  it('reads facts from outside the 6s, 8s and 12s', () => {
    const facts = {
      '1x2': { level: 1, best: 1, fast: 1, slow: 0, missed: 0 },
      '5x7': { level: 4, best: 4, fast: 9, slow: 0, missed: 0 },
      '11x11': { level: 2, best: 2, fast: 2, slow: 1, missed: 1 },
    };
    expect(read({ ...valid, facts })).toEqual(asRead({ ...valid, facts }));
  });

  it('reads a document holding 60 answer times', () => {
    const times = Array.from({ length: 60 }, (_, index) => 1000 + index);
    expect(read({ ...valid, times })).toEqual(asRead({ ...valid, times }));
  });
});

describe('parseProgress on gems, characters and highest levels', () => {
  it('reads a fact whose highest level is above its level', () => {
    const result = read(valid);
    expect(result).toMatchObject({
      progress: { facts: { '6x7': { level: 3, best: 4 } } },
    });
  });

  it('reads a gem total equal to the sum of the highest levels', () => {
    const document = { ...valid, gems: 5, character: 'dragon' };
    expect(read(document)).toEqual(asRead(document));
  });

  it('reads each character that unlocks at the gem total that unlocks it', () => {
    for (const [character, gems] of [
      ['cat', 25],
      ['robot', 60],
      ['owl', 110],
      ['unicorn', 170],
      ['monster', 240],
    ] as const) {
      const document = { ...valid, gems, character };
      expect(read(document)).toEqual(asRead(document));
    }
  });
});

describe('parseProgress on a corrupt document', () => {
  const corrupt: ReadonlyArray<readonly [string, unknown]> = [
    [
      'a level above 4',
      {
        ...valid,
        facts: { '6x7': { level: 5, best: 5, fast: 0, slow: 0, missed: 0 } },
      },
    ],
    [
      'a level below 0',
      {
        ...valid,
        facts: { '6x7': { level: -1, best: 0, fast: 0, slow: 0, missed: 0 } },
      },
    ],
    [
      'a fractional level',
      {
        ...valid,
        facts: { '6x7': { level: 1.5, best: 2, fast: 0, slow: 0, missed: 0 } },
      },
    ],
    ['a 1s table', { ...valid, tables: [1, 6] }],
    ['a 13s table', { ...valid, tables: [6, 13] }],
    ['a table given twice', { ...valid, tables: [6, 6] }],
    ['a record with a 13s table', withRecord({ tables: [13] })],
    ['a record with a 1s table', withRecord({ tables: [1] })],
    ['a record with a table given twice', withRecord({ tables: [6, 6] })],
    [
      'a negative fact count',
      {
        ...valid,
        facts: { '6x7': { level: 1, best: 1, fast: -1, slow: 0, missed: 0 } },
      },
    ],
    ['a negative record count', withRecord({ missed: -1 })],
    [
      'a fact count that is not a number',
      {
        ...valid,
        facts: { '6x7': { level: 1, best: 1, fast: '3', slow: 0, missed: 0 } },
      },
    ],
    [
      'a missing fact count',
      { ...valid, facts: { '6x7': { level: 1, best: 1, fast: 3, slow: 0 } } },
    ],
    [
      'the fact 1 x 1',
      {
        ...valid,
        facts: { '1x1': { level: 1, best: 1, fast: 0, slow: 0, missed: 0 } },
      },
    ],
    [
      'a fact keyed larger factor first',
      {
        ...valid,
        facts: { '7x6': { level: 1, best: 1, fast: 0, slow: 0, missed: 0 } },
      },
    ],
    [
      'a fact with a factor of 13',
      {
        ...valid,
        facts: { '6x13': { level: 1, best: 1, fast: 0, slow: 0, missed: 0 } },
      },
    ],
    ['a fact that is not an object', { ...valid, facts: { '6x7': 3 } }],
    ['no times field', { ...valid, times: undefined }],
    ['a times field that is not an array', { ...valid, times: {} }],
    ['61 answer times', { ...valid, times: Array(61).fill(1000) }],
    ['an answer time at the cap', { ...valid, times: [20000] }],
    ['a negative answer time', { ...valid, times: [-1] }],
    ['a fractional answer time', { ...valid, times: [1200.5] }],
    ['an answer time that is a string', { ...valid, times: ['1200'] }],
    ['a records field that is not an array', { ...valid, records: {} }],
    ['a record with no timestamp', withRecord({ at: undefined })],
    ['a record whose quit flag is not a boolean', withRecord({ quit: 'no' })],
    ['a record with no pace', withRecord({ pace: undefined })],
    ['a record whose pace is at the cap', withRecord({ pace: 20000 })],
    ['a record whose pace is negative', withRecord({ pace: -1 })],
    ['a record whose pace is fractional', withRecord({ pace: 2400.5 })],
    ['a record whose pace is a string', withRecord({ pace: '2.4' })],
    ['a record with no known count', withRecord({ known: undefined })],
    ['a record whose known count is null', withRecord({ known: null })],
    ['a record whose known count is above 77', withRecord({ known: 78 })],
    ['a record whose known count is negative', withRecord({ known: -1 })],
    ['a record whose known count is fractional', withRecord({ known: 1.5 })],
    ['a record with no median', withRecord({ median: undefined })],
    ['a record whose median is at the cap', withRecord({ median: 20000 })],
    ['a record whose median is negative', withRecord({ median: -1 })],
    ['a record whose median is fractional', withRecord({ median: 1900.5 })],
    ['a record whose median is a string', withRecord({ median: '2.4' })],
    ['a version 1 document', { ...valid, version: 1 }],
    ['a version 0 document', { ...valid, version: 0 }],
    ['a version given as a string', { ...valid, version: '3' }],
    ['a newer version given as a string', { ...valid, version: '4' }],
    ['a fractional version', { ...valid, version: 3.5 }],
    ['no gems field', { ...valid, gems: undefined }],
    ['a negative gem total', { ...valid, gems: -1, character: 'dragon' }],
    ['a fractional gem total', { ...valid, gems: 27.5 }],
    ['a gem total that is a string', { ...valid, gems: '27' }],
    [
      'a gem total under the sum of the highest levels',
      { ...valid, gems: 4, character: 'dragon' },
    ],
    ['no character field', { ...valid, character: undefined }],
    ['a character that is not one of the six', { ...valid, character: 'fox' }],
    ['a character the gem total has not unlocked', { ...valid, gems: 24 }],
    [
      'a fact with no highest level',
      { ...valid, facts: { '6x7': { level: 1, fast: 1, slow: 0, missed: 0 } } },
    ],
    [
      'a highest level under the level',
      {
        ...valid,
        facts: { '6x7': { level: 3, best: 2, fast: 3, slow: 0, missed: 0 } },
      },
    ],
    [
      'a highest level above 4',
      {
        ...valid,
        facts: { '6x7': { level: 3, best: 5, fast: 3, slow: 0, missed: 0 } },
      },
    ],
    [
      'a fractional highest level',
      {
        ...valid,
        facts: { '6x7': { level: 3, best: 3.5, fast: 3, slow: 0, missed: 0 } },
      },
    ],
    ['no version', { ...valid, version: undefined }],
    ['no tables field', { ...valid, tables: undefined }],
    ['a tables field that is not an array', { ...valid, tables: 6 }],
    ['no facts field', { ...valid, facts: undefined }],
    ['a facts field that is an array', { ...valid, facts: [] }],
    ['a document that is an array', [valid]],
    ['a document that is null', null],
    ['a document that is a string', 'progress'],
  ];

  for (const [name, document] of corrupt) {
    it(`reads ${name} as corrupt`, () => {
      expect(read(document)).toEqual(CORRUPT);
    });
  }

  it('reads text that is not JSON as corrupt', () => {
    expect(parseProgress('{not json')).toEqual(CORRUPT);
  });

  it('reads an empty string as corrupt', () => {
    expect(parseProgress('')).toEqual(CORRUPT);
  });
});

describe('parseProgress on a document with extra fields', () => {
  it('keeps only the known fields', () => {
    const extra = {
      ...valid,
      note: 'ignored',
      facts: {
        '6x7': { level: 3, best: 3, fast: 12, slow: 3, missed: 2, seen: 17 },
      },
      records: [{ ...valid.records[0], label: 'ignored' }],
    };
    expect(read(extra)).toEqual(
      asRead({
        ...valid,
        facts: { '6x7': { level: 3, best: 3, fast: 12, slow: 3, missed: 2 } },
        records: [valid.records[0]],
      }),
    );
  });
});

// A document the version 2 build accepts.
const VERSION_2 = {
  version: 2,
  tables: [6, 12],
  facts: {
    '6x7': { level: 3, fast: 12, slow: 3, missed: 2 },
    '8x12': { level: 0, fast: 0, slow: 0, missed: 1 },
    '3x5': { level: 4, fast: 6, slow: 0, missed: 0 },
  },
  times: valid.times,
  records: valid.records,
};

describe('parseProgress on a version 2 document', () => {
  it('migrates it: each highest level is the level now, the gems are their sum and the dragon is chosen', () => {
    expect(read(VERSION_2)).toEqual({
      kind: 'read',
      migrated: true,
      progress: {
        version: 3,
        tables: [6, 12],
        facts: {
          '6x7': { level: 3, best: 3, fast: 12, slow: 3, missed: 2 },
          '8x12': { level: 0, best: 0, fast: 0, slow: 0, missed: 1 },
          '3x5': { level: 4, best: 4, fast: 6, slow: 0, missed: 0 },
        },
        gems: 7,
        character: 'dragon',
        times: valid.times,
        records: valid.records,
      },
    });
  });

  it('migrates a fresh version 2 document to a fresh version 3 document', () => {
    const fresh = { version: 2, tables: [], facts: {}, times: [], records: [] };
    expect(read(fresh)).toEqual({
      kind: 'read',
      migrated: true,
      progress: freshProgress(),
    });
  });

  it('takes nothing from version 3 fields a version 2 document happens to hold', () => {
    const document = {
      ...VERSION_2,
      gems: 300,
      character: 'monster',
      facts: { '6x7': { level: 1, best: 4, fast: 1, slow: 0, missed: 0 } },
    };
    expect(read(document)).toMatchObject({
      migrated: true,
      progress: {
        gems: 1,
        character: 'dragon',
        facts: { '6x7': { level: 1, best: 1 } },
      },
    });
  });

  it('reads one that fails version 2 validation as corrupt', () => {
    expect(read({ ...VERSION_2, times: undefined })).toEqual(CORRUPT);
    expect(
      read({
        ...VERSION_2,
        facts: { '6x7': { level: 5, fast: 0, slow: 0, missed: 0 } },
      }),
    ).toEqual(CORRUPT);
  });
});

describe('parseProgress on a document from a newer build', () => {
  it('reads a whole-number version above 3 as newer, whatever else it holds', () => {
    expect(read({ ...valid, version: 4 })).toEqual({ kind: 'newer' });
    expect(read({ version: 12, learner: {} })).toEqual({ kind: 'newer' });
  });
});

describe('factLevel', () => {
  it('reads the level of a fact the document holds', () => {
    expect(factLevel(valid, '6x7')).toBe(3);
  });

  it('reads an absent fact as level 0', () => {
    expect(factLevel(valid, '6x9')).toBe(0);
  });
});

describe('factCounts', () => {
  it('reads the lifetime counts of a fact the document holds', () => {
    expect(factCounts(valid, '6x7')).toEqual({ fast: 12, slow: 3, missed: 2 });
  });

  it('reads an absent fact as no counts', () => {
    expect(factCounts(valid, '6x9')).toEqual({ fast: 0, slow: 0, missed: 0 });
  });
});

describe('knownCount', () => {
  it('is 0 for a fresh document', () => {
    expect(knownCount(freshProgress())).toBe(0);
  });

  it('counts the facts at level 4 and no others', () => {
    const progress: Progress = {
      ...valid,
      facts: {
        '6x7': { level: 4, best: 4, fast: 9, slow: 0, missed: 0 },
        '3x5': { level: 4, best: 4, fast: 6, slow: 1, missed: 0 },
        '8x12': { level: 3, best: 3, fast: 5, slow: 0, missed: 1 },
        '2x2': { level: 0, best: 0, fast: 0, slow: 0, missed: 1 },
      },
    };
    expect(knownCount(progress)).toBe(2);
  });
});

describe('knownShare', () => {
  const known = { level: 4, best: 4, fast: 9, slow: 0, missed: 0 } as const;

  it('is 0 for every table of a fresh document', () => {
    expect(knownShare(freshProgress(), 7)).toBe(0);
  });

  it('is the share of the table’s twelve facts at level 4', () => {
    const progress: Progress = {
      ...freshProgress(),
      facts: {
        '1x6': known,
        '6x7': known,
        '6x8': known,
        '6x9': { level: 3, best: 3, fast: 5, slow: 0, missed: 1 },
        '3x5': known,
      },
    };
    expect(knownShare(progress, 6)).toBe(0.25);
  });

  it('counts a fact towards both of its tables', () => {
    const progress: Progress = {
      ...freshProgress(),
      facts: { '6x8': known },
    };
    expect(knownShare(progress, 6)).toBe(1 / 12);
    expect(knownShare(progress, 8)).toBe(1 / 12);
  });

  it('is 1 when the whole table is known', () => {
    const facts: Progress['facts'] = {};
    for (let n = 1; n <= 12; n++) facts[n <= 9 ? `${n}x9` : `9x${n}`] = known;
    expect(knownShare({ ...freshProgress(), facts }, 9)).toBe(1);
  });
});

describe('applyOutcome', () => {
  it('moves the level and counts the outcome on a fact the document holds', () => {
    const after = applyOutcome(valid, '6x7', 'fast');
    expect(after.facts['6x7']).toEqual({
      level: 4,
      best: 4,
      fast: 13,
      slow: 3,
      missed: 2,
    });
  });

  it('starts an absent fact from level 0 and zero counts', () => {
    const after = applyOutcome(valid, '6x9', 'slow');
    expect(after.facts['6x9']).toEqual({
      level: 0,
      best: 0,
      fast: 0,
      slow: 1,
      missed: 0,
    });
  });

  it('leaves the other facts and the given document as they were', () => {
    const before = structuredClone(valid);
    const after = applyOutcome(valid, '6x7', 'missed');
    expect(after.facts['8x12']).toEqual(valid.facts['8x12']);
    expect(valid).toEqual(before);
  });
});

describe('applyOutcome paying gems', () => {
  it('pays one gem when a fast outcome takes a fact to a level it has not reached before', () => {
    const after = applyOutcome(valid, '6x9', 'fast');
    expect(after.facts['6x9']).toMatchObject({ level: 1, best: 1 });
    expect(after.gems).toBe(28);
  });

  it('pays nothing for a level the fact has reached before', () => {
    // 6 x 7 is at level 3 and has been at level 4.
    const after = applyOutcome(valid, '6x7', 'fast');
    expect(after.facts['6x7']).toMatchObject({ level: 4, best: 4 });
    expect(after.gems).toBe(27);
  });

  it('pays nothing for a slow or missed outcome and keeps the highest level', () => {
    for (const outcome of ['slow', 'missed'] as const) {
      const after = applyOutcome(valid, '6x7', outcome);
      expect(after.facts['6x7']?.best).toBe(4);
      expect(after.gems).toBe(27);
    }
  });

  it('pays nothing for a fast outcome on a fact already at level 4', () => {
    const atTop = applyOutcome(valid, '6x7', 'fast');
    expect(applyOutcome(atTop, '6x7', 'fast').gems).toBe(27);
  });

  it('pays a fact 4 gems on its way from new to level 4 and no more after a miss', () => {
    let progress = freshProgress();
    for (let n = 0; n < 4; n++)
      progress = applyOutcome(progress, '2x3', 'fast');
    expect(progress.gems).toBe(4);
    progress = applyOutcome(progress, '2x3', 'missed');
    for (let n = 0; n < 4; n++)
      progress = applyOutcome(progress, '2x3', 'fast');
    expect(progress.gems).toBe(4);
    expect(progress.facts['2x3']).toMatchObject({ level: 4, best: 4 });
  });

  it('keeps every document it makes valid', () => {
    let progress = freshProgress();
    for (const outcome of ['fast', 'fast', 'slow', 'fast', 'missed'] as const) {
      progress = applyOutcome(progress, '7x8', outcome);
      expect(read(progress)).toEqual(asRead(progress));
    }
  });
});

describe('keepAnswerTime', () => {
  it('appends an answer time under the cap', () => {
    expect(keepAnswerTime(valid, 1800).times).toEqual([2400, 0, 19999, 1800]);
  });

  it('does not keep an answer time at the cap', () => {
    expect(keepAnswerTime(valid, 20000).times).toEqual(valid.times);
  });

  it('leaves the rest of the given document as it was', () => {
    const after = keepAnswerTime(valid, 1800);
    expect(after.facts).toEqual(valid.facts);
    expect(valid.times).toEqual([2400, 0, 19999]);
  });
});

describe('addRecord', () => {
  it('appends the record after the ones already held', () => {
    const record: DrillRecord = {
      at: '2026-01-03T09:00:00.000Z',
      tables: [8],
      fast: 3,
      slow: 0,
      missed: 1,
      quit: true,
      pace: null,
      known: 0,
      median: null,
    };
    const after = addRecord(valid, record);
    expect(after.records).toEqual([...valid.records, record]);
    expect(valid.records).toHaveLength(2);
  });
});
