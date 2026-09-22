import { describe, expect, it } from 'vitest';
import { createSound } from './sound';

// One note as the fake context heard it: the pitch it started on in hertz,
// when it started in seconds, and the loudest its envelope went.
type HeardNote = { freq: number; at: number; peak: number };

// A stand-in for the browser's AudioContext that keeps each note started on
// it, with a state a test can set as iPadOS would.
function fakeContext() {
  const heard: HeardNote[] = [];
  // refuses makes resume reject, as Safari does outside a touch.
  const calls = { resumed: 0, refuses: false };
  const param = (set: (value: number) => void = () => {}) => ({
    value: 0,
    setValueAtTime: (value: number) => set(value),
    exponentialRampToValueAtTime: (value: number) => set(value),
  });
  const context = {
    state: 'running' as AudioContextState | 'interrupted',
    currentTime: 0,
    destination: {},
    resume: () => {
      calls.resumed++;
      return calls.refuses
        ? Promise.reject(new Error('not allowed'))
        : Promise.resolve();
    },
    createGain: () => {
      const node = {
        peak: 0,
        gain: param((value) => {
          node.peak = Math.max(node.peak, value);
        }),
        connect: <T>(to: T) => to,
      };
      return node;
    },
    createOscillator: () => {
      let freq = 0;
      let envelope: { peak: number } | undefined;
      return {
        type: 'sine',
        frequency: param((value) => {
          if (freq === 0) freq = value;
        }),
        connect: <T extends { peak: number }>(to: T) => {
          envelope = to;
          return to;
        },
        start: (at: number) => {
          heard.push({
            freq,
            at,
            // Read when a test asks, so that the order the note was built in
            // does not matter.
            get peak() {
              return envelope?.peak ?? 0;
            },
          });
        },
        stop: () => {},
      };
    },
  };
  return { context, heard, calls };
}

// A sound over a fake context, counting how many contexts it has asked for.
function tracked() {
  const fake = fakeContext();
  const made = { contexts: 0 };
  const sound = createSound(() => {
    made.contexts++;
    return fake.context as unknown as AudioContext;
  });
  return { sound, made, ...fake };
}

describe('createSound', () => {
  it('starts no audio and plays nothing before the first touch', () => {
    const { sound, made, heard } = tracked();

    sound.key();

    expect(made.contexts).toBe(0);
    expect(heard).toEqual([]);
  });

  it('ticks once a touch has started the audio', () => {
    const { sound, made, heard } = tracked();

    sound.wake();
    sound.key();

    expect(made.contexts).toBe(1);
    expect(heard).toHaveLength(1);
  });

  // A context that is not running holds its clock still, so an effect played
  // into it would wait and then sound late, with any others, when it resumed.
  it('drops an effect while the audio is not running', () => {
    const { sound, context, heard } = tracked();
    sound.wake();

    context.state = 'interrupted';
    sound.key();

    expect(heard).toEqual([]);
  });

  it('resumes audio that the iPad stopped, on the next touch', () => {
    const { sound, context, calls } = tracked();
    sound.wake();
    expect(calls.resumed).toBe(0);

    context.state = 'suspended';
    sound.wake();

    expect(calls.resumed).toBe(1);
  });

  it('resumes audio when the app returns from the background, but does not start it', () => {
    const { sound, context, made, calls } = tracked();

    sound.resume();
    expect(made.contexts).toBe(0);

    sound.wake();
    context.state = 'interrupted';
    sound.resume();
    expect(calls.resumed).toBe(1);
  });

  it('carries on when the browser refuses to resume the audio', async () => {
    const { sound, context, calls } = tracked();
    sound.wake();
    context.state = 'suspended';
    calls.refuses = true;
    const unhandled: unknown[] = [];
    const keep = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', keep);

    sound.resume();
    await new Promise((done) => setImmediate(done));

    process.off('unhandledRejection', keep);
    expect(calls.resumed).toBe(1);
    expect(unhandled).toEqual([]);
  });

  // The pitch the effect played last opened on.
  function openingPitch(heard: HeardNote[], play: () => void): number {
    const before = heard.length;
    play();
    return heard[before]?.freq ?? 0;
  }

  it('plays a fast answer a step of the major scale higher for each answer in a streak', () => {
    const { sound, heard } = tracked();
    sound.wake();

    // C6, D6 and E6.
    expect(openingPitch(heard, () => sound.fast(1))).toBeCloseTo(1046.5, 1);
    expect(openingPitch(heard, () => sound.fast(2))).toBeCloseTo(1174.66, 1);
    expect(openingPitch(heard, () => sound.fast(3))).toBeCloseTo(1318.51, 1);
  });

  it('stops climbing at the tenth answer of a streak', () => {
    const { sound, heard } = tracked();
    sound.wake();

    const pitches = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 25].map((streak) =>
      openingPitch(heard, () => sound.fast(streak)),
    );

    for (let i = 1; i < 10; i++) {
      expect(pitches[i]).toBeGreaterThan(pitches[i - 1] ?? Infinity);
    }
    expect(pitches[10]).toBe(pitches[9]);
    expect(pitches[11]).toBe(pitches[9]);
  });

  // The notes the effect played last, in the order they sound.
  function notesOf(heard: HeardNote[], play: () => void): HeardNote[] {
    const before = heard.length;
    play();
    return heard.slice(before).sort((a, b) => a.at - b.at);
  }

  const loudest = (notes: HeardNote[]) =>
    Math.max(...notes.map((note) => note.peak));

  it('plays a slow answer softer than a fast one', () => {
    const { sound, heard } = tracked();
    sound.wake();

    const fast = notesOf(heard, () => sound.fast(1));
    const slow = notesOf(heard, () => sound.slow());

    expect(slow.length).toBeGreaterThan(0);
    expect(loudest(slow)).toBeLessThan(loudest(fast));
  });

  it('plays a miss soft and lower than any right answer', () => {
    const { sound, heard } = tracked();
    sound.wake();

    const fast = notesOf(heard, () => sound.fast(1));
    const slow = notesOf(heard, () => sound.slow());
    const missed = notesOf(heard, () => sound.missed());

    expect(missed.length).toBeGreaterThan(0);
    expect(loudest(missed)).toBeLessThan(loudest(fast));
    const lowestRight = Math.min(...[...fast, ...slow].map((n) => n.freq));
    for (const note of missed) expect(note.freq).toBeLessThan(lowestRight);
  });

  it('sweeps up from a low note to a chord for a drill faster than last time', () => {
    const { sound, heard } = tracked();
    sound.wake();

    const sweep = notesOf(heard, () => sound.faster());

    // C5, then C7, E7 and G7 after it.
    expect(sweep).toHaveLength(4);
    expect(sweep[0]?.freq).toBeCloseTo(523.25, 1);
    expect(sweep[1]?.freq).toBeCloseTo(2093, 1);
    expect(sweep[2]?.freq).toBeCloseTo(2637.02, 1);
    expect(sweep[3]?.freq).toBeCloseTo(3135.96, 1);
    const opening = sweep[0]?.at ?? 0;
    expect(sweep[1]?.at).toBeCloseTo(opening + 0.5, 3);
    expect(sweep[2]?.at).toBeCloseTo(opening + 0.6, 3);
    expect(sweep[3]?.at).toBeCloseTo(opening + 0.7, 3);
  });

  it('plays a fanfare for a new character that climbs to a note above the run up', () => {
    const { sound, heard } = tracked();
    sound.wake();

    const top = notesOf(heard, () => sound.end('top'));
    const fanfare = notesOf(heard, () => sound.unlock());

    // G5, C6, E6, G6 and C7, a tenth of a second apart.
    expect(fanfare.map((note) => Math.round(note.freq))).toEqual([
      784, 1047, 1319, 1568, 2093,
    ]);
    const opening = fanfare[0]?.at ?? 0;
    fanfare.forEach((note, i) =>
      expect(note.at).toBeCloseTo(opening + i * 0.1, 3),
    );
    const highest = (notes: HeardNote[]) =>
      Math.max(...notes.map((note) => note.freq));
    expect(highest(fanfare)).toBeGreaterThan(highest(top));
  });

  it('ends a drill on a run up that is longer for a higher band', () => {
    const { sound, heard } = tracked();
    sound.wake();

    const low = notesOf(heard, () => sound.end('low'));
    const middle = notesOf(heard, () => sound.end('middle'));
    const top = notesOf(heard, () => sound.end('top'));

    expect(low.length).toBeGreaterThan(1);
    expect(middle.length).toBeGreaterThan(low.length);
    expect(top.length).toBeGreaterThan(middle.length);
    for (const run of [low, middle, top]) {
      for (let i = 1; i < run.length; i++) {
        expect(run[i]?.freq).toBeGreaterThan(run[i - 1]?.freq ?? Infinity);
        expect(run[i]?.at).toBeGreaterThan(run[i - 1]?.at ?? Infinity);
      }
    }
  });
});
