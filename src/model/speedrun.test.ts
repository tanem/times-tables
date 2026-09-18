import { describe, expect, it } from 'vitest';
import { FACTS } from './facts';
import {
  answerRun,
  cardOf,
  formatGap,
  formatTime,
  isRunComplete,
  speedRunRecord,
  startRun,
} from './speedrun';

// A repeatable random source: mulberry32 on the given seed.
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const keys = (facts: readonly { key: string }[]) =>
  facts.map((fact) => fact.key);

describe('startRun', () => {
  it('queues every one of the 33 facts once', () => {
    const run = startRun(seeded(1));
    expect(run.queue).toHaveLength(33);
    expect(keys(run.queue.map((shown) => shown.fact)).sort()).toEqual(
      keys(FACTS).sort(),
    );
  });

  it('shuffles the facts, so that any fact is as likely as another to lead', () => {
    const leads = new Map<string, number>();
    for (let seed = 0; seed < 3300; seed++) {
      const first = startRun(seeded(seed)).queue[0];
      if (!first) throw new Error('the queue is empty');
      leads.set(first.fact.key, (leads.get(first.fact.key) ?? 0) + 1);
    }
    // 3300 runs over 33 facts: each leads about 100 times.
    expect(leads.size).toBe(33);
    for (const count of leads.values()) {
      expect(count).toBeGreaterThan(60);
      expect(count).toBeLessThan(140);
    }
  });

  it('shows each fact in either ordering', () => {
    const { queue } = startRun(seeded(2));
    for (const { fact, x, y } of queue) {
      expect([x, y].sort()).toEqual([fact.a, fact.b].sort());
    }
    const swapped = queue.filter(
      ({ fact, x }) => fact.a !== fact.b && x === fact.b,
    );
    expect(swapped.length).toBeGreaterThan(0);
    expect(swapped.length).toBeLessThan(32);
  });
});

describe('answerRun', () => {
  it('takes a got fact off the queue and puts the next on the card', () => {
    const random = seeded(3);
    const run = startRun(random);
    const [first, second] = run.queue;

    const after = answerRun(run, 'fast', random);

    expect(cardOf(run)).toEqual(first);
    expect(cardOf(after)).toEqual(second);
    expect(after.queue).toHaveLength(32);
    expect(keys(after.queue.map((shown) => shown.fact))).not.toContain(
      first?.fact.key,
    );
    expect(isRunComplete(after)).toBe(false);
  });

  it('sends a missed fact to the back of the queue', () => {
    const random = seeded(4);
    const run = startRun(random);
    const [first, second] = run.queue;

    const after = answerRun(run, 'missed', random);

    expect(after.queue).toHaveLength(33);
    expect(cardOf(after)).toEqual(second);
    expect(after.queue.at(-1)?.fact).toEqual(first?.fact);
  });

  it('gives the missed fact a fresh random ordering', () => {
    const run = startRun(seeded(5));
    const { fact } = cardOf(run);
    // 6 × 6 has one ordering; any other fact shows the draw.
    expect(fact.a).not.toBe(fact.b);

    const low = answerRun(run, 'missed', () => 0.25).queue.at(-1);
    const high = answerRun(run, 'missed', () => 0.75).queue.at(-1);

    expect(low).toEqual({ fact, x: fact.a, y: fact.b });
    expect(high).toEqual({ fact, x: fact.b, y: fact.a });
  });

  it('shows a missed fact again at once when it is the only one left', () => {
    const random = seeded(6);
    let run = startRun(random);
    while (run.queue.length > 1) run = answerRun(run, 'fast', random);
    const { fact } = cardOf(run);

    const after = answerRun(run, 'missed', random);

    expect(isRunComplete(after)).toBe(false);
    expect(after.queue).toHaveLength(1);
    expect(cardOf(after).fact).toEqual(fact);
  });

  it('ends the run once every fact has been got, counting a requeued fact again', () => {
    const random = seeded(7);
    let run = startRun(random);
    run = answerRun(run, 'missed', random);
    run = answerRun(run, 'slow', random);
    let answers = 2;
    while (!isRunComplete(run)) {
      run = answerRun(run, 'fast', random);
      answers += 1;
    }

    // 33 facts and one of them twice.
    expect(answers).toBe(34);
    expect(run).toMatchObject({ fast: 32, slow: 1, missed: 1 });
  });

  it('leaves the given run as it was', () => {
    const random = seeded(8);
    const run = startRun(random);
    const before = structuredClone(run);
    answerRun(run, 'missed', random);
    expect(run).toEqual(before);
  });

  it('refuses an answer once the run is complete', () => {
    const random = seeded(9);
    let run = startRun(random);
    while (!isRunComplete(run)) run = answerRun(run, 'fast', random);
    expect(() => answerRun(run, 'fast', random)).toThrow();
  });
});

describe('speedRunRecord', () => {
  const AT = '2026-01-01T09:00:00.000Z';

  it('records a completed run with its tally and its time in whole milliseconds', () => {
    const random = seeded(10);
    let run = answerRun(startRun(random), 'missed', random);
    run = answerRun(run, 'slow', random);
    while (!isRunComplete(run)) run = answerRun(run, 'fast', random);

    expect(speedRunRecord(run, AT, 161300.4)).toEqual({
      mode: 'speed',
      at: AT,
      tables: [6, 8, 12],
      fast: 32,
      slow: 1,
      missed: 1,
      quit: false,
      time: 161300,
    });
  });

  it('records a run given no time as quit, keeping the tally so far', () => {
    const random = seeded(11);
    const run = answerRun(startRun(random), 'fast', random);

    expect(speedRunRecord(run, AT, null)).toEqual({
      mode: 'speed',
      at: AT,
      tables: [6, 8, 12],
      fast: 1,
      slow: 0,
      missed: 0,
      quit: true,
      time: null,
    });
  });

  it('refuses a time for a run with facts still to get', () => {
    expect(() => speedRunRecord(startRun(seeded(12)), AT, 1000)).toThrow();
  });
});

describe('formatTime', () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [0, '0:00.0'],
    [5040, '0:05.0'],
    [59999, '0:59.9'],
    [60000, '1:00.0'],
    [161300, '2:41.3'],
    [3723400, '62:03.4'],
  ];

  for (const [ms, text] of cases) {
    it(`shows ${ms} ms as ${text}`, () => {
      expect(formatTime(ms)).toBe(text);
    });
  }
});

describe('formatGap', () => {
  it('is the difference between the two times as they are shown', () => {
    // 2:43.7 against 2:41.3, though the milliseconds are 2.39 s apart.
    expect(formatGap(163740, 161350)).toBe('2.4 s');
  });

  it('is zero for a time that shows the same as the best', () => {
    expect(formatGap(161390, 161310)).toBe('0.0 s');
  });

  it('stays in seconds past a minute', () => {
    expect(formatGap(236300, 161300)).toBe('75.0 s');
  });
});
