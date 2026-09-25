import { describe, expect, it } from 'vitest';
import { CROWN, type HatId } from './catalogue';
import { pool, type Table } from './facts';
import {
  applyOutcome,
  badges,
  buy,
  chooseCharacter,
  chooseHat,
  factCounts,
  factLevel,
  freshProgress,
  keepAnswerTime,
  knownCount,
  knownShare,
  ownedHats,
  parseProgress,
  recordDrill,
  type DrillRecord,
  type FactProgress,
  type Progress,
  type ProgressRead,
} from './progress';

// Each character's own colour, and no finished drill with any of them.
const OWN_COLOURS = freshProgress().colours;
const NO_BOND = freshProgress().bond;

const valid: Progress = {
  version: 4,
  tables: [6, 12],
  facts: {
    '6x7': { level: 3, best: 4, fast: 12, slow: 3, missed: 2 },
    '8x12': { level: 0, best: 1, fast: 1, slow: 0, missed: 1 },
  },
  // The 5 the facts have paid, and 122 in bonuses and band pay.
  earned: 127,
  // What is left after a hat, a colour variant and a theme at 125.
  balance: 2,
  character: 'cat',
  owned: ['party-hat', 'cat-grey', 'ocean'],
  hat: 'party-hat',
  colours: { ...OWN_COLOURS, cat: 'cat-grey' },
  theme: 'ocean',
  bond: { ...NO_BOND, dragon: 12, cat: 3 },
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

// The six hats of the set.
const SET_OWNED: HatId[] = [
  'party-hat',
  'top-hat',
  'wizard-hat',
  'cowboy-hat',
  'pirate-hat',
  'bobble-hat',
];

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
  it('starts at version 4 with no table on, nothing learnt, no gems, nothing owned and the dragon', () => {
    expect(freshProgress()).toEqual({
      version: 4,
      tables: [],
      facts: {},
      earned: 0,
      balance: 0,
      character: 'dragon',
      owned: [],
      hat: null,
      colours: {
        dragon: null,
        cat: null,
        robot: null,
        owl: null,
        unicorn: null,
        monster: null,
      },
      theme: null,
      bond: { dragon: 0, cat: 0, robot: 0, owl: 0, unicorn: 0, monster: 0 },
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

  it('reads an earned total equal to the sum of the highest levels', () => {
    const document = { ...valid, earned: 5, balance: 0, character: 'dragon' };
    expect(read(document)).toEqual(asRead(document));
  });

  it('reads each character that unlocks at the earned total that unlocks it', () => {
    for (const [character, earned] of [
      ['cat', 25],
      ['robot', 60],
      ['owl', 110],
      ['unicorn', 170],
      ['monster', 240],
    ] as const) {
      const document = { ...valid, earned, balance: 0, character };
      expect(read(document)).toEqual(asRead(document));
    }
  });

  it('reads a balance of 0 and a balance equal to what was earned', () => {
    for (const balance of [0, 127]) {
      const document = { ...valid, balance };
      expect(read(document)).toEqual(asRead(document));
    }
  });

  it('reads a balance too high for what is owned, since a price can change', () => {
    const document = { ...valid, balance: 127 };
    expect(read(document)).toEqual(asRead(document));
  });
});

describe('parseProgress on items', () => {
  it('reads nothing owned, no hat, own colours and the default theme', () => {
    const document = {
      ...valid,
      owned: [],
      hat: null,
      colours: OWN_COLOURS,
      theme: null,
    };
    expect(read(document)).toEqual(asRead(document));
  });

  it('reads an owned item that is not in use', () => {
    const document = { ...valid, hat: null, theme: null };
    expect(read(document)).toEqual(asRead(document));
  });

  it('reads every item in the catalogue owned, the crown worn', () => {
    const document = {
      ...valid,
      owned: [
        ...SET_OWNED,
        'crown',
        'dragon-blue',
        'dragon-purple',
        'cat-grey',
        'cat-black',
        'ocean',
        'space',
        'backflip',
      ],
      hat: 'crown',
      colours: { ...OWN_COLOURS, dragon: 'dragon-purple', cat: 'cat-black' },
      theme: 'space',
    };
    expect(read(document)).toEqual(asRead(document));
  });

  it('reads the set owned without the crown', () => {
    const document = {
      ...valid,
      owned: SET_OWNED,
      colours: OWN_COLOURS,
      theme: null,
    };
    expect(read(document)).toEqual(asRead(document));
  });

  it('reads a bond with every character', () => {
    const bond = {
      dragon: 50,
      cat: 25,
      robot: 10,
      owl: 1,
      unicorn: 0,
      monster: 0,
    };
    expect(read({ ...valid, bond })).toEqual(asRead({ ...valid, bond }));
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
    ['a version given as a string', { ...valid, version: '4' }],
    ['a newer version given as a string', { ...valid, version: '5' }],
    ['a fractional version', { ...valid, version: 4.5 }],
    ['no earned field', { ...valid, earned: undefined }],
    [
      'a negative earned total',
      { ...valid, earned: -1, balance: 0, character: 'dragon' },
    ],
    ['a fractional earned total', { ...valid, earned: 127.5 }],
    ['an earned total that is a string', { ...valid, earned: '127' }],
    [
      'an earned total under the sum of the highest levels',
      { ...valid, earned: 4, balance: 0, character: 'dragon' },
    ],
    ['no balance field', { ...valid, balance: undefined }],
    ['a negative balance', { ...valid, balance: -1 }],
    ['a fractional balance', { ...valid, balance: 1.5 }],
    ['a balance that is a string', { ...valid, balance: '2' }],
    ['a balance above the earned total', { ...valid, balance: 128 }],
    ['no character field', { ...valid, character: undefined }],
    ['a character that is not one of the six', { ...valid, character: 'fox' }],
    [
      'a character the earned total has not unlocked',
      { ...valid, earned: 24, balance: 0 },
    ],
    ['no owned field', { ...valid, owned: undefined }],
    ['an owned field that is not an array', { ...valid, owned: {} }],
    [
      'an owned item that is not in the catalogue',
      { ...valid, owned: [...valid.owned, 'jetpack'] },
    ],
    [
      'an owned item given twice',
      { ...valid, owned: [...valid.owned, 'party-hat'] },
    ],
    [
      'the crown without every hat of the set',
      { ...valid, owned: [...valid.owned, ...SET_OWNED.slice(1, 5), 'crown'] },
    ],
    ['no hat field', { ...valid, hat: undefined }],
    ['a hat that is not owned', { ...valid, hat: 'top-hat' }],
    ['a worn item that is not a hat', { ...valid, hat: 'ocean' }],
    ['a hat that is not in the catalogue', { ...valid, hat: 'jetpack' }],
    ['no colours field', { ...valid, colours: undefined }],
    ['a colours field that is an array', { ...valid, colours: [] }],
    [
      'a character missing from the colours',
      { ...valid, colours: { ...valid.colours, owl: undefined } },
    ],
    [
      'a colour for a character that is not one of the six',
      { ...valid, colours: { ...valid.colours, fox: null } },
    ],
    [
      'a colour that is not owned',
      { ...valid, colours: { ...valid.colours, cat: 'cat-black' } },
    ],
    [
      'a colour variant chosen for the wrong character',
      { ...valid, colours: { ...valid.colours, dragon: 'cat-grey' } },
    ],
    [
      'a colour that is not a colour variant',
      { ...valid, colours: { ...valid.colours, cat: 'ocean' } },
    ],
    ['no theme field', { ...valid, theme: undefined }],
    ['a theme that is not owned', { ...valid, theme: 'space' }],
    ['a theme that is not a theme', { ...valid, theme: 'party-hat' }],
    ['no bond field', { ...valid, bond: undefined }],
    ['a bond field that is an array', { ...valid, bond: [] }],
    [
      'a character missing from the bond',
      { ...valid, bond: { ...valid.bond, owl: undefined } },
    ],
    [
      'a bond with a character that is not one of the six',
      { ...valid, bond: { ...valid.bond, fox: 1 } },
    ],
    ['a negative bond', { ...valid, bond: { ...valid.bond, cat: -1 } }],
    ['a fractional bond', { ...valid, bond: { ...valid.bond, cat: 1.5 } }],
    [
      'a bond that is a string',
      { ...valid, bond: { ...valid.bond, cat: '3' } },
    ],
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

// A document the version 3 build accepts.
const VERSION_3 = {
  version: 3,
  tables: [6, 12],
  facts: valid.facts,
  // The 5 the facts have paid, and 22 in bonuses.
  gems: 27,
  character: 'cat',
  times: valid.times,
  records: valid.records,
};

describe('parseProgress on a version 3 document', () => {
  it('migrates it: earned and the balance are both its gems, nothing is owned or worn and every bond is 0', () => {
    expect(read(VERSION_3)).toEqual({
      kind: 'read',
      migrated: true,
      progress: {
        version: 4,
        tables: [6, 12],
        facts: valid.facts,
        earned: 27,
        balance: 27,
        character: 'cat',
        owned: [],
        hat: null,
        colours: OWN_COLOURS,
        theme: null,
        bond: NO_BOND,
        times: valid.times,
        records: valid.records,
      },
    });
  });

  it('migrates a fresh version 3 document to a fresh version 4 document', () => {
    const fresh = {
      version: 3,
      tables: [],
      facts: {},
      gems: 0,
      character: 'dragon',
      times: [],
      records: [],
    };
    expect(read(fresh)).toEqual({
      kind: 'read',
      migrated: true,
      progress: freshProgress(),
    });
  });

  it('takes nothing from version 4 fields a version 3 document happens to hold', () => {
    const document = { ...valid, ...VERSION_3 };
    expect(read(document)).toEqual({
      kind: 'read',
      migrated: true,
      progress: {
        ...valid,
        earned: 27,
        balance: 27,
        owned: [],
        hat: null,
        colours: OWN_COLOURS,
        theme: null,
        bond: NO_BOND,
      },
    });
  });

  it('reads one that fails version 3 validation as corrupt', () => {
    for (const document of [
      { ...VERSION_3, gems: undefined },
      { ...VERSION_3, gems: 4 },
      { ...VERSION_3, gems: 24 },
      { ...VERSION_3, times: undefined },
      { ...valid, version: 3 },
    ]) {
      expect(read(document)).toEqual(CORRUPT);
    }
  });
});

describe('parseProgress on a version 2 document', () => {
  it('reads it as corrupt, however well-formed', () => {
    const version2 = {
      version: 2,
      tables: [6, 12],
      facts: { '6x7': { level: 3, fast: 12, slow: 3, missed: 2 } },
      times: valid.times,
      records: valid.records,
    };
    expect(read(version2)).toEqual(CORRUPT);
    expect(
      read({ version: 2, tables: [], facts: {}, times: [], records: [] }),
    ).toEqual(CORRUPT);
  });
});

describe('parseProgress on a document from a newer build', () => {
  it('reads a whole-number version above 4 as newer, whatever else it holds', () => {
    expect(read({ ...valid, version: 5 })).toEqual({ kind: 'newer' });
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
  it('pays one gem to earned and the balance when a fast outcome takes a fact to a level it has not reached before', () => {
    const after = applyOutcome(valid, '6x9', 'fast');
    expect(after.facts['6x9']).toMatchObject({ level: 1, best: 1 });
    expect(after).toMatchObject({ earned: 128, balance: 3 });
  });

  it('pays nothing for a level the fact has reached before', () => {
    // 6 x 7 is at level 3 and has been at level 4.
    const after = applyOutcome(valid, '6x7', 'fast');
    expect(after.facts['6x7']).toMatchObject({ level: 4, best: 4 });
    expect(after).toMatchObject({ earned: 127, balance: 2 });
  });

  it('pays nothing for a slow or missed outcome and keeps the highest level', () => {
    for (const outcome of ['slow', 'missed'] as const) {
      const after = applyOutcome(valid, '6x7', outcome);
      expect(after.facts['6x7']?.best).toBe(4);
      expect(after).toMatchObject({ earned: 127, balance: 2 });
    }
  });

  it('pays nothing for a fast outcome on a fact already at level 4', () => {
    const atTop = applyOutcome(valid, '6x7', 'fast');
    expect(applyOutcome(atTop, '6x7', 'fast')).toMatchObject({
      earned: 127,
      balance: 2,
    });
  });

  it('pays a fact 4 gems on its way from new to level 4 and no more after a miss', () => {
    let progress = freshProgress();
    for (let n = 0; n < 4; n++)
      progress = applyOutcome(progress, '2x3', 'fast');
    expect(progress).toMatchObject({ earned: 4, balance: 4 });
    progress = applyOutcome(progress, '2x3', 'missed');
    for (let n = 0; n < 4; n++)
      progress = applyOutcome(progress, '2x3', 'fast');
    expect(progress).toMatchObject({ earned: 4, balance: 4 });
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

describe('recordDrill', () => {
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
    const after = recordDrill(valid, record, valid).progress;
    expect(after.records).toEqual([...valid.records, record]);
    expect(valid.records).toHaveLength(2);
  });

  // The document's last record is a finished drill on the 6s, 8s and 12s
  // with 18 right answers and a median of 19999. This one is in the top
  // band.
  const faster: DrillRecord = {
    at: '2026-01-03T09:00:00.000Z',
    tables: [6, 8, 12],
    fast: 15,
    slow: 3,
    missed: 2,
    quit: false,
    pace: 2400,
    known: 77,
    median: 8000,
  };
  const slower: DrillRecord = { ...faster, median: 19999 };

  it('pays the bonus of two gems and top band pay of three for a top drill faster than last time', () => {
    const recorded = recordDrill(valid, faster, valid);
    expect(recorded.progress).toMatchObject({ earned: 132, balance: 7 });
    expect(recorded).toMatchObject({ faster: true, bandPay: 3 });
  });

  it('pays band pay alone for a drill that was not faster', () => {
    const recorded = recordDrill(valid, slower, valid);
    expect(recorded.progress).toMatchObject({ earned: 130, balance: 5 });
    expect(recorded).toMatchObject({ faster: false, bandPay: 3 });
  });

  it('pays 3 in the top band, 1 in the middle band and nothing in the low band', () => {
    for (const [fast, pay] of [
      [20, 3],
      [15, 3],
      [14, 1],
      [8, 1],
      [7, 0],
      [0, 0],
    ] as const) {
      const record = { ...slower, fast, slow: 18 - fast };
      const recorded = recordDrill(valid, record, valid);
      expect(recorded.bandPay).toBe(pay);
      expect(recorded.progress).toMatchObject({
        earned: 127 + pay,
        balance: 2 + pay,
      });
    }
  });

  it('pays nothing for a quit drill, however many fast answers it held', () => {
    const recorded = recordDrill(
      valid,
      { ...faster, fast: 16, quit: true },
      valid,
    );
    expect(recorded).toMatchObject({ faster: false, bandPay: 0 });
    expect(recorded.progress).toMatchObject({ earned: 127, balance: 2 });
  });

  it("adds one to the chosen character's bond for a finished drill, and to no other", () => {
    const { progress } = recordDrill(valid, slower, valid);
    expect(progress.bond).toEqual({ ...valid.bond, cat: 4 });
  });

  it('adds nothing to the bond for a quit drill', () => {
    const { progress } = recordDrill(valid, { ...slower, quit: true }, valid);
    expect(progress.bond).toEqual(valid.bond);
  });

  it('says a drill was faster when, and only when, it paid the bonus', () => {
    expect(recordDrill(valid, faster, valid).faster).toBe(true);
    expect(recordDrill(valid, slower, valid).faster).toBe(false);
  });

  it('keeps the document it makes valid', () => {
    const { progress } = recordDrill(valid, faster, valid);
    expect(read(progress)).toEqual(asRead(progress));
  });

  it('leaves the given document as it was', () => {
    recordDrill(valid, faster, valid);

    expect(valid).toMatchObject({ earned: 127, balance: 2 });
    expect(valid.bond).toEqual({ ...NO_BOND, dragon: 12, cat: 3 });
  });
});

// The document with every fact of the given tables at a highest level of 4,
// each at the given level, and earned raised by the gems their highest
// levels paid.
function withTablesDone(
  progress: Progress,
  tables: readonly Table[],
  level: FactProgress['level'] = 4,
): Progress {
  const facts = { ...progress.facts };
  let paid = 0;
  for (const fact of pool(tables)) {
    paid += 4 - (facts[fact.key]?.best ?? 0);
    facts[fact.key] = { level, best: 4, fast: 4, slow: 0, missed: 0 };
  }
  return {
    ...progress,
    facts,
    earned: progress.earned + paid,
    balance: progress.balance + paid,
  };
}

describe('badges', () => {
  it('lists no table for a fresh document', () => {
    expect(badges(freshProgress())).toEqual([]);
  });

  it('lists a table when all twelve of its facts have a highest level of 4', () => {
    expect(badges(withTablesDone(freshProgress(), [7]))).toEqual([7]);
  });

  it('leaves out a table with one fact short of a highest level of 4', () => {
    const done = withTablesDone(freshProgress(), [7]);
    const short: Progress = {
      ...done,
      facts: {
        ...done.facts,
        '7x9': { level: 3, best: 3, fast: 3, slow: 0, missed: 0 },
      },
    };
    expect(badges(short)).toEqual([]);
  });

  it('keeps a badge when the levels drop, since it reads the highest levels', () => {
    expect(badges(withTablesDone(freshProgress(), [7], 0))).toEqual([7]);
  });

  it('counts a fact towards both of its tables, and lists the tables in order', () => {
    // The 8s and the 6s share 6 x 8.
    const progress = withTablesDone(freshProgress(), [8, 6]);
    expect(badges(progress)).toEqual([6, 8]);
  });
});

// A finished drill in the low band that was not faster, so that recording
// it pays nothing.
const plain: DrillRecord = {
  at: '2026-01-03T09:00:00.000Z',
  tables: [7],
  fast: 5,
  slow: 10,
  missed: 5,
  quit: false,
  pace: 2400,
  known: 12,
  median: 19999,
};

// The document with every fact of the given tables at level 4 but the one
// named, which is at level 3 and has never been higher, so that a fast
// answer on it completes them.
function shortOf(
  progress: Progress,
  tables: readonly Table[],
  key: string,
): Progress {
  const done = withTablesDone(progress, tables);
  return {
    ...done,
    facts: {
      ...done.facts,
      [key]: { level: 3, best: 3, fast: 3, slow: 0, missed: 0 },
    },
    earned: done.earned - 1,
    balance: done.balance - 1,
  };
}

describe('applyOutcome paying badges', () => {
  it('pays 10 gems to earned and the balance, with the fact’s gem, for the table the answer completes', () => {
    const before = shortOf(valid, [7], '7x8');
    const after = applyOutcome(before, '7x8', 'fast');
    expect(badges(after)).toEqual([7]);
    expect(after).toMatchObject({
      earned: before.earned + 11,
      balance: before.balance + 11,
    });
  });

  it('pays 20 for an answer that completes two tables at once', () => {
    // 7 x 9 is in both the 7s and the 9s.
    const before = shortOf(valid, [7, 9], '7x9');
    const after = applyOutcome(before, '7x9', 'fast');
    expect(badges(after)).toEqual([7, 9]);
    expect(after.earned).toBe(before.earned + 21);
  });

  it('pays nothing more for a table that already has its badge', () => {
    const before = withTablesDone(valid, [7], 3);
    const after = applyOutcome(before, '7x8', 'fast');
    expect(after.earned).toBe(before.earned);
  });

  it('keeps the document it makes valid', () => {
    const after = applyOutcome(shortOf(valid, [7], '7x8'), '7x8', 'fast');
    expect(read(after)).toEqual(asRead(after));
  });
});

describe('recordDrill reporting badges', () => {
  it('lists the tables badged since the drill began and pays nothing more for them', () => {
    const ended = withTablesDone(valid, [7]);
    const recorded = recordDrill(ended, plain, valid);
    expect(recorded.newBadges).toEqual([7]);
    expect(recorded.progress).toMatchObject({
      earned: ended.earned,
      balance: ended.balance,
    });
  });

  it('lists both tables of a drill that completed two at once', () => {
    const ended = withTablesDone(valid, [7, 9]);
    expect(recordDrill(ended, plain, valid).newBadges).toEqual([7, 9]);
  });

  it('lists no table already complete as the drill began', () => {
    const started = withTablesDone(valid, [7]);
    expect(recordDrill(started, plain, started).newBadges).toEqual([]);
  });

  it('lists the table a quit drill completed', () => {
    const ended = withTablesDone(valid, [7]);
    const recorded = recordDrill(ended, { ...plain, quit: true }, valid);
    expect(recorded.newBadges).toEqual([7]);
  });

  it('does not list or pay a table a migrated document’s levels already complete', () => {
    // The 7s' facts pay 44 more than the version 3 document's own, which
    // already hold 6 x 7 at a highest level of 4.
    const { facts } = withTablesDone(valid, [7]);
    const migrated = read({ ...VERSION_3, facts, gems: 27 + 44 });
    if (migrated.kind !== 'read') throw new Error('not read');
    const { progress } = migrated;
    expect(badges(progress)).toEqual([7]);
    expect(progress).toMatchObject({ earned: 71, balance: 71 });
    const recorded = recordDrill(progress, plain, progress);
    expect(recorded.newBadges).toEqual([]);
    expect(recorded.progress.earned).toBe(71);
  });
});

describe('recordDrill announcing unlocks', () => {
  it('lists every character earned crossed since the drill began, in unlock order', () => {
    const started = { ...freshProgress(), earned: 24, balance: 24 };
    // 24, and 48 from the 2s' facts: 72.
    const ended = withTablesDone(started, [2]);
    const recorded = recordDrill(ended, { ...plain, tables: [2] }, started);
    expect(recorded.progress.earned).toBe(72);
    expect(recorded.unlocks).toEqual(['cat', 'robot']);
  });

  it('lists none when earned crossed no unlock total', () => {
    expect(recordDrill(valid, plain, valid).unlocks).toEqual([]);
  });
});

describe('chooseCharacter', () => {
  it('sets a character the earned total has unlocked', () => {
    expect(chooseCharacter(valid, 'dragon').character).toBe('dragon');
    expect(chooseCharacter(valid, 'owl').character).toBe('owl');
  });

  it('reads the unlocks from earned, not the balance', () => {
    const spent = { ...valid, earned: 60, balance: 0 };
    expect(chooseCharacter(spent, 'robot').character).toBe('robot');
  });

  it('leaves the choice as it was for a character the earned total has not unlocked', () => {
    expect(chooseCharacter(valid, 'unicorn').character).toBe('cat');
    expect(chooseCharacter(freshProgress(), 'cat').character).toBe('dragon');
  });

  it('leaves the rest of the given document as it was', () => {
    const after = chooseCharacter(valid, 'dragon');
    expect({ ...after, character: 'cat' }).toEqual(valid);
    expect(valid.character).toBe('cat');
  });
});

describe('buy', () => {
  const rich = { ...freshProgress(), earned: 300, balance: 100 };

  it('takes the price off the balance and adds the item to what is owned', () => {
    const after = buy(rich, 'top-hat');
    expect(after).toMatchObject({
      earned: 300,
      balance: 60,
      owned: ['top-hat'],
    });
  });

  it('buys with a balance of exactly the price', () => {
    const after = buy({ ...rich, balance: 40 }, 'top-hat');
    expect(after).toMatchObject({ balance: 0, owned: ['top-hat'] });
  });

  it('adds to what is owned already, in the order bought', () => {
    const after = buy(buy(rich, 'top-hat'), 'party-hat');
    expect(after.owned).toEqual(['top-hat', 'party-hat']);
    expect(after.balance).toBe(20);
  });

  it('buys any item whatever the earned total has unlocked', () => {
    const poor = { ...freshProgress(), earned: 100, balance: 100 };
    expect(buy(poor, 'backflip').owned).toEqual(['backflip']);
    expect(buy(poor, 'cat-black').owned).toEqual(['cat-black']);
  });

  it('leaves the document as it was when the balance is short of the price', () => {
    const short = { ...rich, balance: 39 };
    expect(buy(short, 'top-hat')).toBe(short);
  });

  it('leaves the document as it was for an item owned already', () => {
    const owning = { ...rich, owned: ['top-hat' as const] };
    expect(buy(owning, 'top-hat')).toBe(owning);
  });

  it('never sells the crown, which has no price', () => {
    expect(buy(rich, 'crown')).toBe(rich);
  });

  it('adds the crown with the sixth hat of the set', () => {
    const five = { ...rich, owned: SET_OWNED.slice(0, 5) };
    const after = buy(five, 'bobble-hat');
    expect(after.owned).toEqual([...SET_OWNED, 'crown']);
    expect(after.balance).toBe(60);
  });

  it('adds the crown once, whatever is bought after the set', () => {
    const crowned: Progress = { ...rich, owned: [...SET_OWNED, CROWN] };
    expect(buy(crowned, 'ocean').owned).toEqual([...SET_OWNED, CROWN, 'ocean']);
  });

  it('adds no crown while a hat of the set is still to buy', () => {
    const four = { ...rich, owned: SET_OWNED.slice(0, 4) };
    expect(buy(four, 'pirate-hat').owned).not.toContain('crown');
  });

  it('keeps every document it makes valid', () => {
    let progress: Progress = { ...freshProgress(), earned: 400, balance: 400 };
    for (const id of [...SET_OWNED, 'ocean' as const]) {
      progress = buy(progress, id);
      expect(read(progress)).toEqual(asRead(progress));
    }
    expect(progress.owned).toContain('crown');
  });

  it('leaves the given document as it was', () => {
    buy(rich, 'top-hat');
    expect(rich).toMatchObject({ balance: 100, owned: [] });
  });
});

describe('ownedHats', () => {
  it('lists none for a fresh document', () => {
    expect(ownedHats(freshProgress())).toEqual([]);
  });

  it('lists the owned hats in catalogue order, the crown last, and no other item', () => {
    const progress: Progress = {
      ...freshProgress(),
      owned: ['ocean', ...SET_OWNED.toReversed(), 'crown', 'cat-grey'],
    };
    expect(ownedHats(progress)).toEqual([...SET_OWNED, 'crown']);
  });
});

describe('chooseHat', () => {
  const owning: Progress = {
    ...freshProgress(),
    owned: ['top-hat', 'ocean'],
    hat: null,
  };

  it('sets an owned hat', () => {
    expect(chooseHat(owning, 'top-hat').hat).toBe('top-hat');
  });

  it('takes the hat off for none', () => {
    const wearing = { ...owning, hat: 'top-hat' as const };
    expect(chooseHat(wearing, null).hat).toBeNull();
  });

  it('leaves the choice as it was for a hat not owned', () => {
    const wearing = { ...owning, hat: 'top-hat' as const };
    expect(chooseHat(wearing, 'party-hat').hat).toBe('top-hat');
    expect(chooseHat(owning, 'crown').hat).toBeNull();
  });

  it('keeps the document it makes valid and leaves the given one as it was', () => {
    const after = chooseHat(owning, 'top-hat');
    expect(read(after)).toEqual(asRead(after));
    expect(owning.hat).toBeNull();
  });
});
