// The app's only access to Web Audio, so that a test can stand in for the
// iPad's audio from outside the app. Short square-wave effects, synthesised
// from oscillators so that there is no file to load. Every effect goes with
// something already on screen, and the iPad's volume and mute are the only
// controls.

import type { Band } from './model/drill';

// How loud every effect is mixed down to: medium, on the iPad's speaker.
const MASTER = 0.35;

// How long a note rings, in seconds, unless it says otherwise.
const RING = 0.14;

// How loud a note at full gain peaks, before the mix down.
const PEAK = 0.175;

// As good as silent: an exponential ramp cannot start from or reach zero.
const SILENT = 0.0001;

// How long a note takes to reach its peak, in seconds, short enough to
// sound struck and long enough not to click.
const ATTACK = 0.008;

// How far ahead of the context's clock an effect starts, in seconds, so
// that its first note is not scheduled in the past.
const LEAD = 0.01;

// How long an oscillator runs on past its ring, in seconds, so that it
// stops once it is silent.
const TAIL = 0.05;

type Note = {
  // Hertz.
  freq: number;
  // Seconds after the effect starts.
  at?: number;
  // A share of the full peak.
  gain?: number;
  // A pitch the note slides to over its ring.
  slideTo?: number;
  // A ring in seconds in place of the usual one.
  ring?: number;
};

// Equal-tempered pitches by semitones from C5.
const C5 = 523.25;
const pitch = (semitones: number) => C5 * 2 ** (semitones / 12);

// The run up that ends a drill, as the notes of a C major chord in semitones
// from C5: longer for a higher band.
const END_RUNS: Readonly<Record<Band, readonly number[]>> = {
  top: [0, 4, 7, 12, 16],
  middle: [0, 4, 7],
  low: [0, 7],
};

// The gap between the notes of the run up, in seconds.
const RUN_GAP = 0.11;

// How far the streak's climb has gone by each answer of a streak, in
// semitones up a major scale. The climb stops at the last.
const CLIMB = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];

export type Sound = {
  // Starts the audio, or brings it back. Called on every touch.
  wake: () => void;
  // Brings back audio a touch has already started, as the app returns from
  // the background. Starts nothing by itself.
  resume: () => void;
  // A tick for a key of the pad.
  key: () => void;
  // A fast answer, a step of the scale higher for each answer in the streak,
  // which counts this one.
  fast: (streak: number) => void;
  // A slow answer: one note, softer than a fast one.
  slow: () => void;
  // A miss: soft, low and falling.
  missed: () => void;
  // The end of a drill: a run up, longer for a higher band.
  end: (band: Band) => void;
};

// Builds the app's sound over the given way of making an audio context.
// Nothing is made until the first touch, which is the earliest a browser
// lets audio start.
export function createSound(newContext: () => AudioContext): Sound {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;

  // iPadOS suspends or interrupts the context when the app goes to the
  // background, so a touch resumes it as well as starting it.
  const wake = () => {
    if (!context) {
      context = newContext();
      master = context.createGain();
      master.gain.value = MASTER;
      master.connect(context.destination);
    }
    // The browser can refuse outside a touch. The next touch asks again.
    if (context.state !== 'running') context.resume().catch(() => {});
  };

  const play = (notes: readonly Note[]) => {
    if (!context || !master) return;
    // A context that is not running holds its clock still, so anything
    // scheduled on it would all sound at once when it resumed.
    if (context.state !== 'running') return;
    const start = context.currentTime + LEAD;
    for (const note of notes) {
      const at = start + (note.at ?? 0);
      const ring = note.ring ?? RING;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(note.freq, at);
      if (note.slideTo) {
        oscillator.frequency.exponentialRampToValueAtTime(
          note.slideTo,
          at + ring,
        );
      }
      envelope.gain.setValueAtTime(SILENT, at);
      envelope.gain.exponentialRampToValueAtTime(
        (note.gain ?? 1) * PEAK,
        at + ATTACK,
      );
      envelope.gain.exponentialRampToValueAtTime(SILENT, at + ring);
      oscillator.connect(envelope).connect(master);
      oscillator.start(at);
      oscillator.stop(at + ring + TAIL);
    }
  };

  return {
    wake,
    resume: () => {
      if (context) wake();
    },
    // A short, quiet G6.
    key: () => play([{ freq: pitch(19), gain: 0.25, ring: 0.03 }]),
    // C6 then the E6 above it, both moved up by the climb.
    fast: (streak) => {
      const climb = CLIMB[Math.min(streak, CLIMB.length) - 1] ?? 0;
      play([
        { freq: pitch(12 + climb) },
        { freq: pitch(16 + climb), at: 0.09 },
      ]);
    },
    // G5.
    slow: () => play([{ freq: pitch(7), gain: 0.6 }]),
    // E4 sliding down to C4.
    missed: () =>
      play([{ freq: pitch(-8), slideTo: pitch(-12), gain: 0.4, ring: 0.3 }]),
    end: (band) =>
      play(
        END_RUNS[band].map((semitones, i) => ({
          freq: pitch(semitones),
          at: i * RUN_GAP,
          ring: 0.5,
        })),
      ),
  };
}

// The app's sound, over the browser's own audio.
export const sound = createSound(() => new AudioContext());

// Wakes the sound on every touch and brings it back when the app returns
// from the background. A touch unlocks audio on its release, not its press,
// so both ends of a touch are listened for.
export function mountSound(): void {
  for (const type of [
    'pointerdown',
    'pointerup',
    'touchend',
    'click',
    'keydown',
  ]) {
    document.addEventListener(type, sound.wake, { capture: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sound.resume();
  });
}
