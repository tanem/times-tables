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

export const test = base.extend<{ fixedRandomAndClock: void }>({
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
