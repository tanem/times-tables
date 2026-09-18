import { describe, expect, it } from 'vitest';
import {
  addRecord,
  applyOutcome,
  correctOutcome,
  factLevel,
  freshProgress,
  parseProgress,
  type DrillRecord,
  type Progress,
} from './progress';

const valid: Progress = {
  version: 1,
  tables: [6, 12],
  facts: {
    '6x7': { level: 3, fast: 12, slow: 3, missed: 2 },
    '8x12': { level: 0, fast: 0, slow: 0, missed: 1 },
  },
  records: [
    {
      mode: 'drill',
      at: '2026-01-01T09:00:00.000Z',
      tables: [6, 12],
      fast: 14,
      slow: 4,
      missed: 2,
      quit: false,
      time: null,
    },
    {
      mode: 'speed',
      at: '2026-01-02T09:00:00.000Z',
      tables: [6, 8, 12],
      fast: 30,
      slow: 2,
      missed: 1,
      quit: false,
      time: 161300,
    },
  ],
};

describe('freshProgress', () => {
  it('starts with all three tables on and nothing learnt', () => {
    expect(freshProgress()).toEqual({
      version: 1,
      tables: [6, 8, 12],
      facts: {},
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
    ['a table other than 6, 8 or 12', { ...valid, tables: [6, 7] }],
    ['a table given twice', { ...valid, tables: [6, 6] }],
    [
      'a record with a table other than 6, 8 or 12',
      { ...valid, records: [{ ...valid.records[0], tables: [9] }] },
    ],
    [
      'a negative fact count',
      {
        ...valid,
        facts: { '6x7': { level: 1, fast: -1, slow: 0, missed: 0 } },
      },
    ],
    [
      'a negative record count',
      { ...valid, records: [{ ...valid.records[0], missed: -1 }] },
    ],
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
      'a fact outside the fact set',
      { ...valid, facts: { '5x7': { level: 1, fast: 0, slow: 0, missed: 0 } } },
    ],
    ['a fact that is not an object', { ...valid, facts: { '6x7': 3 } }],
    ['a records field that is not an array', { ...valid, records: {} }],
    [
      'a record with an unknown mode',
      { ...valid, records: [{ ...valid.records[0], mode: 'race' }] },
    ],
    [
      'a record with no timestamp',
      { ...valid, records: [{ ...valid.records[0], at: undefined }] },
    ],
    [
      'a record whose quit flag is not a boolean',
      { ...valid, records: [{ ...valid.records[0], quit: 'no' }] },
    ],
    [
      'a record whose time is negative',
      { ...valid, records: [{ ...valid.records[1], time: -1 }] },
    ],
    [
      'a record whose time is a string',
      { ...valid, records: [{ ...valid.records[1], time: '2:41.3' }] },
    ],
    ['an unknown version', { ...valid, version: 2 }],
    ['a version given as a string', { ...valid, version: '1' }],
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
    const before = JSON.parse(JSON.stringify(valid));
    const after = applyOutcome(valid, '6x7', 'missed');
    expect(after.facts['8x12']).toEqual(valid.facts['8x12']);
    expect(valid).toEqual(before);
  });
});

describe('correctOutcome', () => {
  it('moves a fast outcome to missed and sets the level to 0', () => {
    const after = correctOutcome(
      applyOutcome(valid, '6x7', 'fast'),
      '6x7',
      'fast',
    );
    expect(after.facts['6x7']).toEqual({
      level: 0,
      fast: 12,
      slow: 3,
      missed: 3,
    });
  });

  it('moves a slow outcome to missed', () => {
    const after = correctOutcome(
      applyOutcome(valid, '6x9', 'slow'),
      '6x9',
      'slow',
    );
    expect(after.facts['6x9']).toEqual({
      level: 0,
      fast: 0,
      slow: 0,
      missed: 1,
    });
  });

  it('leaves the other facts and the given document as they were', () => {
    const answered = applyOutcome(valid, '6x7', 'fast');
    const before = JSON.parse(JSON.stringify(answered));
    const after = correctOutcome(answered, '6x7', 'fast');
    expect(after.facts['8x12']).toEqual(valid.facts['8x12']);
    expect(answered).toEqual(before);
  });
});

describe('addRecord', () => {
  it('appends the record after the ones already held', () => {
    const record: DrillRecord = {
      mode: 'drill',
      at: '2026-01-03T09:00:00.000Z',
      tables: [8],
      fast: 3,
      slow: 0,
      missed: 1,
      quit: true,
      time: null,
    };
    const after = addRecord(valid, record);
    expect(after.records).toEqual([...valid.records, record]);
    expect(valid.records).toHaveLength(2);
  });
});
