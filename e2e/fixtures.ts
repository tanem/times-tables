import { test as base, expect } from '@playwright/test';

// A fixed seed and a fixed date, so every run sees the same draws and the
// same timestamps.
const SEED = 20260918;
const TIME = '2026-01-01T09:00:00.000Z';

// Replaces Math.random with mulberry32 before any app code runs, which is
// what the app's random module then reads.
const seedRandom = (seed: number) => {
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// One note as the recording audio heard it: the pitch it started on in
// hertz and when it started, in seconds on the context's clock.
export type HeardNote = { freq: number; at: number };

// What the recording audio keeps on the window for a test to read: the notes
// started, how often the app resumed it, and a state the test can set as
// iPadOS would.
export type RecordedAudio = {
  heard: HeardNote[];
  resumed: number;
  state: AudioContextState | 'interrupted';
};

declare global {
  interface Window {
    recordedAudio: RecordedAudio;
  }
}

// Replaces AudioContext before any app code runs with one that keeps each
// note instead of sounding it, which is what the app's sound module then
// makes on the first touch.
const recordAudio = () => {
  const audio: RecordedAudio = { heard: [], resumed: 0, state: 'running' };
  window.recordedAudio = audio;
  const param = (set: (value: number) => void = () => {}) => ({
    value: 0,
    setValueAtTime: set,
    exponentialRampToValueAtTime: set,
  });
  class RecordingContext {
    currentTime = 0;
    destination = {};
    get state() {
      return audio.state;
    }
    resume() {
      audio.resumed++;
      audio.state = 'running';
      return Promise.resolve();
    }
    createGain() {
      return { gain: param(), connect: <T>(to: T) => to };
    }
    createOscillator() {
      let freq = 0;
      return {
        type: 'sine',
        frequency: param((value) => {
          if (freq === 0) freq = value;
        }),
        connect: <T>(to: T) => to,
        start: (at: number) => audio.heard.push({ freq, at }),
        stop: () => {},
      };
    }
  }
  window.AudioContext = RecordingContext as unknown as typeof AudioContext;
};

export const test = base.extend<{
  fixedRandomAndClock: void;
  recordedAudio: void;
}>({
  recordedAudio: [
    async ({ page }, use) => {
      await page.addInitScript(recordAudio);
      await use();
    },
    { auto: true },
  ],
  fixedRandomAndClock: [
    async ({ page }, use) => {
      await page.addInitScript(seedRandom, SEED);
      // Puts Date, the timers, performance and animation frames under the
      // test's control, and holds them still until a test moves them on.
      await page.clock.install({ time: TIME });
      await page.clock.pauseAt(TIME);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
