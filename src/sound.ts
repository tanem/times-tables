// The app's only access to Web Audio, so that a test can stand in for the
// iPad's audio from outside the app. Short square-wave effects, synthesised
// from oscillators so that there is no file to load. Every effect goes with
// something already on screen, and the iPad's volume and mute are the only
// controls.

import type { Band } from './model/drill';

// The level every effect is mixed down to: medium, on the iPad's speaker.
const MASTER = 0.35;

// How long a note rings, in seconds, unless it says otherwise.
const RING = 0.14;

// How loud a note at full gain peaks, before the master level.
const LEVEL = 0.175;

type Note = {
  // Hertz.
  freq: number;
  // Seconds after the effect starts.
  at?: number;
  // A share of the full level.
  gain?: number;
  // A pitch the note slides to over its ring.
  slideTo?: number;
  // A ring in seconds in place of the usual one.
  ring?: number;
};

// Equal-tempered pitches by semitones from C5.
const C5 = 523.25;
const pitch = (semitones: number) => C5 * 2 ** (semitones / 12);

// The run up that ends a drill, in semitones from C5: longer for a higher
// band.
const END_RUNS: Readonly<Record<Band, readonly number[]>> = {
  top: [0, 4, 7, 12, 16],
  middle: [0, 4, 7],
  low: [0, 7],
};

// The steps of a major scale in semitones, for the streak's climb.
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];

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
    if (context.state !== 'running') void context.resume();
  };

  const play = (notes: readonly Note[]) => {
    if (!context || !master) return;
    // A context that is not running holds its clock still, so anything
    // scheduled on it would all sound at once when it resumed.
    if (context.state !== 'running') return;
    const start = context.currentTime + 0.01;
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
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(
        (note.gain ?? 1) * LEVEL,
        at + 0.008,
      );
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + ring);
      oscillator.connect(envelope).connect(master);
      oscillator.start(at);
      oscillator.stop(at + ring + 0.05);
    }
  };

  return {
    wake,
    resume: () => {
      if (context) wake();
    },
    key: () => play([{ freq: pitch(19), gain: 0.25, ring: 0.03 }]),
    fast: (streak) => {
      const step = SCALE[Math.min(streak, SCALE.length) - 1] ?? 0;
      play([{ freq: pitch(12 + step) }, { freq: pitch(16 + step), at: 0.09 }]);
    },
    slow: () => play([{ freq: pitch(7), gain: 0.6 }]),
    missed: () =>
      play([{ freq: pitch(-8), slideTo: pitch(-12), gain: 0.4, ring: 0.3 }]),
    end: (band) =>
      play(
        END_RUNS[band].map((step, i) => ({
          freq: pitch(step),
          at: i * 0.11,
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
