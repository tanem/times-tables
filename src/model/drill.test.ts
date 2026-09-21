import { describe, expect, it } from 'vitest';
import {
  DRILL_LENGTH,
  answer,
  bandOf,
  drawFact,
  drillRecord,
  isComplete,
  present,
  quitDrill,
  startDrill,
  type Drill,
} from './drill';
import { FACTS, TABLES, pool, type Fact } from './facts';
import type { Level, Outcome } from './level';

// A random source that hands out the given values in turn, then fails.
function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index++];
    if (value === undefined) throw new Error('the random sequence ran out');
    return value;
  };
}

// A level lookup from a map of key to level; other facts are at level 0.
function levels(known: Record<string, Level>): (key: string) => Level {
  return (key) => known[key] ?? 0;
}

const sixes = pool([6]);

// The nth fact of the 6s: 1 × 6, 2 × 6 and so on.
function six(index: number): Fact {
  const fact = sixes[index];
  if (!fact) throw new Error(`no fact at ${index}`);
  return fact;
}

describe('drawFact', () => {
  it('never draws a fact shown in the last three', () => {
    const candidates = [six(0), six(1), six(2), six(3)];
    const recent = [six(0), six(1), six(2)].map((fact) => fact.key);
    for (const value of [0, 0.3, 0.6, 0.999]) {
      expect(
        drawFact(candidates, recent, levels({}), sequence([value])),
      ).toEqual(six(3));
    }
  });

  it('draws in proportion to the weights of the levels', () => {
    const known = six(0);
    const unknown = six(1);
    const levelOf = levels({ [known.key]: 4, [unknown.key]: 0 });
    let drewUnknown = 0;
    for (let i = 0; i < 1000; i++) {
      const fact = drawFact(
        [known, unknown],
        [],
        levelOf,
        sequence([i / 1000]),
      );
      if (fact === unknown) drewUnknown += 1;
    }
    // Weight 1 against weight 8: the values below 1/9 (0.000 to 0.111) land
    // on the known fact, the other 888 on the unknown one.
    expect(drewUnknown).toBe(888);
  });

  it('walks the pool in order as the random value rises', () => {
    const first = six(0);
    const second = six(1);
    const third = six(2);
    const levelOf = levels({
      [first.key]: 1,
      [second.key]: 2,
      [third.key]: 3,
    });
    // Weights 4, 2, 1 over a total of 7.
    const candidates = [first, second, third];
    expect(drawFact(candidates, [], levelOf, sequence([0]))).toBe(first);
    expect(drawFact(candidates, [], levelOf, sequence([4 / 7]))).toBe(second);
    expect(drawFact(candidates, [], levelOf, sequence([6 / 7]))).toBe(third);
  });
});

describe('startDrill', () => {
  it('draws from the union of the chosen tables', () => {
    const drill = startDrill([6, 12], levels({}), sequence([0, 0]));
    expect(drill.pool).toEqual(pool([6, 12]));
    expect(drill.tables).toEqual([6, 12]);
  });

  it('shows the first fact at once', () => {
    const drill = startDrill([6], levels({}), sequence([0, 0]));
    expect(drill.current.fact).toBe(six(0));
    expect(drill.answered).toBe(0);
  });

  it('picks the ordering of the presentation at random', () => {
    const smallerFirst = startDrill([6], levels({}), sequence([0, 0.2]));
    expect([smallerFirst.current.x, smallerFirst.current.y]).toEqual([1, 6]);
    const largerFirst = startDrill([6], levels({}), sequence([0, 0.7]));
    expect([largerFirst.current.x, largerFirst.current.y]).toEqual([6, 1]);
  });

  it('starts with nothing answered and no streak', () => {
    const drill = startDrill([6], levels({}), sequence([0, 0]));
    expect(drill).toMatchObject({
      fast: 0,
      slow: 0,
      missed: 0,
      streak: 0,
      bestStreak: 0,
      quit: false,
    });
    expect(isComplete(drill)).toBe(false);
  });
});

// A drill of the 6s answered with the given outcomes, each either bare or
// with its answer time beside it, presenting the next fact after each answer
// with a random source that always draws the first eligible fact.
function drillAfter(outcomes: Array<Outcome | [Outcome, number]>): Drill {
  const random = () => 0;
  let drill = startDrill([6], levels({}), random);
  for (const entry of outcomes) {
    const [outcome, time] = Array.isArray(entry) ? entry : [entry, 0];
    drill = answer(drill, outcome, time);
    if (!isComplete(drill)) drill = present(drill, levels({}), random);
  }
  return drill;
}

describe('answer', () => {
  it('tallies each outcome', () => {
    const drill = drillAfter(['fast', 'slow', 'missed', 'fast', 'fast']);
    expect(drill).toMatchObject({ fast: 3, slow: 1, missed: 1, answered: 5 });
  });

  it('counts consecutive fast outcomes as the streak', () => {
    expect(drillAfter(['fast', 'fast', 'fast']).streak).toBe(3);
  });

  it('resets the streak on a slow outcome', () => {
    expect(drillAfter(['fast', 'fast', 'slow']).streak).toBe(0);
  });

  it('resets the streak on a missed outcome', () => {
    expect(drillAfter(['fast', 'fast', 'missed']).streak).toBe(0);
  });

  it('keeps the best streak of the drill', () => {
    const drill = drillAfter(['fast', 'fast', 'fast', 'missed', 'fast']);
    expect(drill.streak).toBe(1);
    expect(drill.bestStreak).toBe(3);
  });

  it('keeps the answer times of the right answers alone', () => {
    const drill = drillAfter([
      ['fast', 1200],
      ['missed', 800],
      ['slow', 5000],
    ]);
    expect(drill.times).toEqual([1200, 5000]);
  });

  it('does not keep an answer time at the cap', () => {
    expect(
      drillAfter([
        ['fast', 1200],
        ['slow', 20000],
      ]).times,
    ).toEqual([1200]);
  });

  it('completes the drill after the twentieth answer', () => {
    const drill = drillAfter(Array<'fast'>(DRILL_LENGTH).fill('fast'));
    expect(isComplete(drill)).toBe(true);
    expect(drill.answered).toBe(20);
  });
});

describe('present', () => {
  it('never shows a fact from the last three presentations', () => {
    const shown: string[] = [];
    const random = () => 0;
    let drill = startDrill([6], levels({}), random);
    for (let i = 0; i < DRILL_LENGTH; i++) {
      const key = drill.current.fact.key;
      expect(shown.slice(-3)).not.toContain(key);
      shown.push(key);
      drill = answer(drill, 'fast', 0);
      if (!isComplete(drill)) drill = present(drill, levels({}), random);
    }
    expect(shown).toHaveLength(DRILL_LENGTH);
  });

  it('draws with the levels as they are after the answer', () => {
    const second = six(1);
    const random = () => 0;
    let drill = startDrill([6], levels({}), random);
    drill = answer(drill, 'fast', 0);
    // The levels handed in decide the weights. With the first fact just
    // shown, the second at level 0 and the other ten at level 4, the weights
    // are 8 and ten 1s, so 0.4 of the total lands on the second; were every
    // fact at level 4 the same value would land on the fifth.
    const levelOf = (key: string): Level => (key === second.key ? 0 : 4);
    drill = present(drill, levelOf, sequence([0.4, 0]));
    expect(drill.current.fact).toBe(second);
    expect(present(drill, () => 4, sequence([0.4, 0])).current?.fact).toBe(
      six(5),
    );
  });
});

describe('quitDrill', () => {
  it('marks the drill as quit and keeps the answers given', () => {
    const drill = quitDrill(drillAfter(['fast', 'missed']));
    expect(drill).toMatchObject({ quit: true, fast: 1, missed: 1 });
    expect(isComplete(drill)).toBe(true);
  });
});

describe('drillRecord', () => {
  it('records a finished drill with its tally, the known count and no pace', () => {
    const drill = drillAfter([
      ...Array<'fast'>(14).fill('fast'),
      ...Array<'slow'>(4).fill('slow'),
      ...Array<'missed'>(2).fill('missed'),
    ]);
    expect(drillRecord(drill, '2026-01-01T09:05:00.000Z', 5, null)).toEqual({
      at: '2026-01-01T09:05:00.000Z',
      tables: [6],
      fast: 14,
      slow: 4,
      missed: 2,
      quit: false,
      pace: null,
      known: 5,
      median: 0,
    });
  });

  it('has no median when the drill had no right answer under the cap', () => {
    const drill = drillAfter([
      ['missed', 1500],
      ['fast', 20000],
    ]);
    expect(
      drillRecord(drill, '2026-01-01T09:05:00.000Z', 0, null),
    ).toMatchObject({ median: null });
  });

  it('records the pace it is given and the median of the drill’s own answer times', () => {
    const drill = drillAfter([
      ['fast', 1000],
      ['fast', 2000],
      ['missed', 9000],
      ['slow', 4200],
    ]);
    expect(drillRecord(drill, '2026-01-01T09:05:00.000Z', 5, 2600)).toEqual({
      at: '2026-01-01T09:05:00.000Z',
      tables: [6],
      fast: 2,
      slow: 1,
      missed: 1,
      quit: false,
      pace: 2600,
      known: 5,
      median: 2000,
    });
  });

  it('records a quit drill with the answers given so far', () => {
    const drill = quitDrill(drillAfter(['fast', 'slow', 'slow']));
    expect(
      drillRecord(drill, '2026-01-01T09:05:00.000Z', 3, 2600),
    ).toMatchObject({
      fast: 1,
      slow: 2,
      missed: 0,
      quit: true,
      known: 3,
      pace: 2600,
    });
  });
});

describe('the fact set', () => {
  it('is the source of the drill pool', () => {
    expect(startDrill([...TABLES], levels({}), () => 0).pool).toEqual(FACTS);
  });
});

describe('bandOf', () => {
  // A full drill with the given number of fast answers and the rest slow.
  function drillWithFast(fast: number): Drill {
    return drillAfter([
      ...Array<'fast'>(fast).fill('fast'),
      ...Array<'slow'>(DRILL_LENGTH - fast).fill('slow'),
    ]);
  }

  it('is the top band from 15 fast answers of 20', () => {
    expect(bandOf(drillWithFast(15))).toBe('top');
    expect(bandOf(drillWithFast(20))).toBe('top');
  });

  it('is the middle band from 8 to 14 fast answers', () => {
    expect(bandOf(drillWithFast(14))).toBe('middle');
    expect(bandOf(drillWithFast(8))).toBe('middle');
  });

  it('is the low band below 8 fast answers', () => {
    expect(bandOf(drillWithFast(7))).toBe('low');
    expect(bandOf(drillWithFast(0))).toBe('low');
  });

  it('is the low band for any quit drill', () => {
    const quit = quitDrill(drillAfter(Array<'fast'>(16).fill('fast')));
    expect(bandOf(quit)).toBe('low');
  });
});
