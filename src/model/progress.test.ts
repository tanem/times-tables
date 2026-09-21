import { describe, expect, it } from 'vitest';
import {
  addRecord,
  applyOutcome,
  factCounts,
  factLevel,
  freshProgress,
  keepAnswerTime,
  knownCount,
  parseProgress,
  type DrillRecord,
  type Progress,
} from './progress';

const valid: Progress = {
  version: 2,
  tables: [6, 12],
  facts: {
    '6x7': { level: 3, fast: 12, slow: 3, missed: 2 },
    '8x12': { level: 0, fast: 0, slow: 0, missed: 1 },
  },
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

// The valid document holding one drill record, with some of the record's
// fields replaced.
function withRecord(fields: Record<string, unknown>): unknown {
  return { ...valid, records: [{ ...valid.records[1], ...fields }] };
}

describe('freshProgress', () => {
  it('starts at version 2 with the 6s, 8s and 12s on and nothing learnt', () => {
    expect(freshProgress()).toEqual({
      version: 2,
      tables: [6, 8, 12],
      facts: {},
      times: [],
      records: [],
    });
  });

  it('gives each caller its own document', () => {
    const first = freshProgress();
    first.tables.pop();
    expect(freshProgress().tables).toEqual([6, 8, 12]);
  });
});

describe('parseProgress', () => {
  it('reads back a valid document', () => {
    expect(parseProgress(JSON.stringify(valid))).toEqual(valid);
  });

  it('reads a document with no tables on', () => {
    expect(parseProgress(JSON.stringify({ ...valid, tables: [] }))).toEqual({
      ...valid,
      tables: [],
    });
  });

  it('reads a document with all eleven tables on', () => {
    const tables = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(parseProgress(JSON.stringify({ ...valid, tables }))).toEqual({
      ...valid,
      tables,
    });
  });

  it('reads facts from outside the 6s, 8s and 12s', () => {
    const facts = {
      '1x2': { level: 1, fast: 1, slow: 0, missed: 0 },
      '5x7': { level: 4, fast: 9, slow: 0, missed: 0 },
      '11x11': { level: 2, fast: 2, slow: 1, missed: 1 },
    };
    expect(parseProgress(JSON.stringify({ ...valid, facts }))).toEqual({
      ...valid,
      facts,
    });
  });

  it('reads a document holding 60 answer times', () => {
    const times = Array.from({ length: 60 }, (_, index) => 1000 + index);
    expect(parseProgress(JSON.stringify({ ...valid, times }))).toEqual({
      ...valid,
      times,
    });
  });
});

describe('parseProgress on a corrupt document', () => {
  const corrupt: ReadonlyArray<readonly [string, unknown]> = [
    [
      'a level above 4',
      { ...valid, facts: { '6x7': { level: 5, fast: 0, slow: 0, missed: 0 } } },
    ],
    [
      'a level below 0',
      {
        ...valid,
        facts: { '6x7': { level: -1, fast: 0, slow: 0, missed: 0 } },
      },
    ],
    [
      'a fractional level',
      {
        ...valid,
        facts: { '6x7': { level: 1.5, fast: 0, slow: 0, missed: 0 } },
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
        facts: { '6x7': { level: 1, fast: -1, slow: 0, missed: 0 } },
      },
    ],
    ['a negative record count', withRecord({ missed: -1 })],
    [
      'a fact count that is not a number',
      {
        ...valid,
        facts: { '6x7': { level: 1, fast: '3', slow: 0, missed: 0 } },
      },
    ],
    [
      'a missing fact count',
      { ...valid, facts: { '6x7': { level: 1, fast: 3, slow: 0 } } },
    ],
    [
      'the fact 1 x 1',
      { ...valid, facts: { '1x1': { level: 1, fast: 0, slow: 0, missed: 0 } } },
    ],
    [
      'a fact keyed larger factor first',
      { ...valid, facts: { '7x6': { level: 1, fast: 0, slow: 0, missed: 0 } } },
    ],
    [
      'a fact with a factor of 13',
      {
        ...valid,
        facts: { '6x13': { level: 1, fast: 0, slow: 0, missed: 0 } },
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
    ['an unknown version', { ...valid, version: 3 }],
    ['a version given as a string', { ...valid, version: '2' }],
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
      expect(parseProgress(JSON.stringify(document))).toBeNull();
    });
  }

  it('reads text that is not JSON as corrupt', () => {
    expect(parseProgress('{not json')).toBeNull();
  });

  it('reads an empty string as corrupt', () => {
    expect(parseProgress('')).toBeNull();
  });
});

describe('parseProgress on a document with extra fields', () => {
  it('keeps only the known fields', () => {
    const extra = {
      ...valid,
      note: 'ignored',
      facts: { '6x7': { level: 3, fast: 12, slow: 3, missed: 2, seen: 17 } },
      records: [{ ...valid.records[0], label: 'ignored' }],
    };
    expect(parseProgress(JSON.stringify(extra))).toEqual({
      ...valid,
      facts: { '6x7': { level: 3, fast: 12, slow: 3, missed: 2 } },
      records: [valid.records[0]],
    });
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
        '6x7': { level: 4, fast: 9, slow: 0, missed: 0 },
        '3x5': { level: 4, fast: 6, slow: 1, missed: 0 },
        '8x12': { level: 3, fast: 5, slow: 0, missed: 1 },
        '2x2': { level: 0, fast: 0, slow: 0, missed: 1 },
      },
    };
    expect(knownCount(progress)).toBe(2);
  });
});

describe('applyOutcome', () => {
  it('moves the level and counts the outcome on a fact the document holds', () => {
    const after = applyOutcome(valid, '6x7', 'fast');
    expect(after.facts['6x7']).toEqual({
      level: 4,
      fast: 13,
      slow: 3,
      missed: 2,
    });
  });

  it('starts an absent fact from level 0 and zero counts', () => {
    const after = applyOutcome(valid, '6x9', 'slow');
    expect(after.facts['6x9']).toEqual({
      level: 0,
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
