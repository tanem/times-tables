import type { Locator, Page } from '@playwright/test';
import type { DrillRecord } from '../src/model/progress';
import { expect, test } from './fixtures';
import {
  confetti,
  dragon,
  factOnScreen,
  getEveryFact,
  keyOnScreen,
  openWithRecords,
  sparkles,
  startCountdown,
  startRun,
  storedProgress,
} from './helpers';

function speedRunButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Speed run' });
}

test('before any completed run the Speed run button says what it is', async ({
  page,
}) => {
  await page.goto('./');
  await expect(speedRunButton(page)).toBeEnabled();
  await expect(speedRunButton(page)).toHaveAccessibleDescription(
    'all 33 facts, no best yet',
  );
});

// The running clock at the top of the run card.
function clock(page: Page): Locator {
  return page.getByRole('timer', { name: 'Time' });
}

// The dragon, whatever it is doing.
function anyDragon(page: Page): Locator {
  return page.getByRole('img', { name: /^The dragon/ });
}

test('a run counts down 3-2-1 and then shows the clock in tenths in place of the bar', async ({
  page,
}) => {
  await page.goto('./');
  await startCountdown(page);
  await page.clock.runFor(1000);
  await expect(
    page.getByRole('heading', { level: 1, name: '2' }),
  ).toBeVisible();
  await page.clock.runFor(1000);
  await expect(
    page.getByRole('heading', { level: 1, name: '1' }),
  ).toBeVisible();
  await page.clock.runFor(999);
  await expect(clock(page)).toHaveCount(0);
  await page.clock.runFor(1);

  await expect(clock(page)).toHaveText('0:00.0');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^\d+ × \d+$/,
  );
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByText('/ 20')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Missed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quit' })).toBeVisible();

  await page.clock.runFor(1250);
  await expect(clock(page)).toHaveText('0:01.2');
});

test('the dragon stays off the run card and the miss reveal', async ({
  page,
}) => {
  await page.goto('./');
  await startRun(page);
  await expect(anyDragon(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Missed' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('=');
  await expect(anyDragon(page)).toHaveCount(0);
});

test('Got it never turns amber in a run', async ({ page }) => {
  await page.goto('./');
  await startRun(page);
  await page.clock.runFor(3000);

  await expect(page.getByRole('button', { name: 'Got it' })).toHaveCSS(
    'background-color',
    'rgb(47, 158, 68)',
  );
  await expect(page.getByText('Time is up')).toHaveCount(0);
});

test('Got it moves straight to the next fact with no feedback', async ({
  page,
}) => {
  await page.goto('./');
  await startRun(page);
  const first = await keyOnScreen(page);

  await page.getByRole('button', { name: 'Got it' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^\d+ × \d+$/,
  );
  expect(await keyOnScreen(page)).not.toBe(first);
  await expect(page.getByText('Fast!')).toHaveCount(0);
  await expect(page.getByText('Tap to go on')).toHaveCount(0);
});

test('a missed fact shows its answer for 1.5 seconds with the clock running, then the next fact', async ({
  page,
}) => {
  await page.goto('./');
  await startRun(page);
  const { x, y } = await factOnScreen(page);
  await page.clock.runFor(1000);

  await page.getByRole('button', { name: 'Missed' }).click();

  const answer = page.getByRole('heading', {
    level: 1,
    name: `${x} × ${y} = ${x * y}`,
  });
  await expect(answer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Got it' })).toHaveCount(0);
  await page.clock.runFor(1499);
  await expect(answer).toBeVisible();
  await expect(clock(page)).toHaveText('0:02.4');

  await page.clock.runFor(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^\d+ × \d+$/,
  );
  await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
  await expect(clock(page)).toHaveText('0:02.5');
});

test('each answer is timed against 3 seconds and moves the stored level and counts as in a drill', async ({
  page,
}) => {
  await page.goto('./');
  await startRun(page);

  const fast = await keyOnScreen(page);
  await page.clock.runFor(2999);
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect
    .poll(async () => (await storedProgress(page)).facts[fast])
    .toEqual({ level: 1, fast: 1, slow: 0, missed: 0 });

  const slow = await keyOnScreen(page);
  await page.clock.runFor(3000);
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect
    .poll(async () => (await storedProgress(page)).facts[slow])
    .toEqual({ level: 0, fast: 0, slow: 1, missed: 0 });

  const missed = await keyOnScreen(page);
  await page.getByRole('button', { name: 'Missed' }).click();
  await expect
    .poll(async () => (await storedProgress(page)).facts[missed])
    .toEqual({ level: 0, fast: 0, slow: 0, missed: 1 });
});

// The sparkles the dragon breathes out at a new best.
function breath(page: Page): Locator {
  return page.getByRole('img', { name: 'Sparkle breath' });
}

// What a first completed run and a new best get: the dragon stands proud
// breathing sparkles under confetti. The sparkles and the confetti go; the
// dragon stays.
async function expectProudCelebration(page: Page): Promise<void> {
  const proud = dragon(page, 'stands proud');
  await expect(proud).toBeVisible();
  await expect(breath(page)).toBeVisible();
  await expect(confetti(page)).toBeVisible();

  await page.clock.runFor(2400);
  await expect(breath(page)).toHaveCount(0);
  await expect(confetti(page)).toHaveCount(0);
  await expect(proud).toBeVisible();
}

// How tall the learner sees the part once it has stopped moving, in pixels.
async function heightAtRest(page: Page, part: Locator): Promise<number> {
  let still = 0;
  let last = await part.boundingBox();
  for (let look = 0; look < 100 && still < 3; look++) {
    await page.waitForTimeout(50);
    const next = await part.boundingBox();
    still = JSON.stringify(next) === JSON.stringify(last) ? still + 1 : 0;
    last = next;
  }
  if (!last || still < 3) throw new Error('never came to rest');
  return last.height;
}

// A completed speed run with the given time, as the stored document has it.
function completedRun(time: number): DrillRecord {
  return {
    mode: 'speed',
    at: '2025-12-31T09:00:00.000Z',
    tables: [6, 8, 12],
    fast: 33,
    slow: 0,
    missed: 0,
    quit: false,
    time,
  };
}

test('a first run shows every fact, brings a missed fact back, and ends on its time', async ({
  page,
}) => {
  await page.goto('./');
  await startRun(page);

  const missedKey = await keyOnScreen(page);
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Missed' }).click();
  await page.clock.runFor(1500);

  // The other 32 facts come first, then the missed one again.
  const got = page.getByRole('button', { name: 'Got it' });
  const shown: string[] = [];
  for (let i = 0; i < 33; i++) {
    shown.push(await keyOnScreen(page));
    await page.clock.runFor(1000);
    await got.click();
  }
  expect(new Set(shown).size).toBe(33);
  expect(shown.at(-1)).toBe(missedKey);

  // 34 answers at a second each and the 1.5 second reveal.
  await expect(
    page.getByRole('heading', { level: 1, name: 'Your first time!' }),
  ).toBeVisible();
  await expect(page.getByText('0:35.5')).toBeVisible();
  await expect(page.getByText('1 missed')).toBeVisible();
  await expect(page.getByText(/best/i)).toHaveCount(0);
  await expectProudCelebration(page);

  const { records, facts } = await storedProgress(page);
  expect(records).toEqual([
    {
      mode: 'speed',
      at: '2026-01-01T09:00:38.500Z',
      tables: [6, 8, 12],
      fast: 33,
      slow: 0,
      missed: 1,
      quit: false,
      time: 35500,
    },
  ]);
  expect(facts[missedKey]).toEqual({ level: 1, fast: 1, slow: 0, missed: 1 });

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(speedRunButton(page)).toHaveAccessibleDescription('Best 0:35.5');
});

test('a faster run is a new best over the previous one, and Run again counts down', async ({
  page,
}) => {
  await openWithRecords(page, [completedRun(20000), completedRun(25000)]);
  await expect(speedRunButton(page)).toHaveAccessibleDescription('Best 0:20.0');
  await startRun(page);
  await getEveryFact(page, 500);

  await expect(
    page.getByRole('heading', { level: 1, name: 'New best!' }),
  ).toBeVisible();
  await expect(page.getByText('0:16.5', { exact: true })).toBeVisible();
  await expect(page.getByText('0 missed')).toBeVisible();
  await expect(page.getByText('Previous best 0:20.0')).toBeVisible();
  await expectProudCelebration(page);

  await page.getByRole('button', { name: 'Run again' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: '3' }),
  ).toBeVisible();
});

test('the dragon holds the proud pose, puffed up bigger than it stands after a wave', async ({
  page,
}) => {
  await openWithRecords(page, [completedRun(20000)]);
  await startRun(page);
  await getEveryFact(page, 700);
  const waved = await heightAtRest(page, dragon(page, 'waves'));

  await page.getByRole('button', { name: 'Run again' }).click();
  await page.clock.runFor(3000);
  await getEveryFact(page, 500);
  await page.clock.runFor(5000);

  const proud = await heightAtRest(page, dragon(page, 'stands proud'));
  expect(proud).toBeGreaterThan(1.1 * waved);
});

test('a run that ties the best is a slower run', async ({ page }) => {
  await openWithRecords(page, [completedRun(16500)]);
  await startRun(page);
  await getEveryFact(page, 500);

  await expect(
    page.getByRole('heading', { level: 1, name: '0.0 s off your best' }),
  ).toBeVisible();
  await expect(page.getByText('Your best 0:16.5')).toBeVisible();
  await expect(dragon(page, 'waves')).toBeVisible();
  await expect(breath(page)).toHaveCount(0);
  await expect(confetti(page)).toHaveCount(0);
});

test('a slower run shows its gap to the best with a warm wave', async ({
  page,
}) => {
  await openWithRecords(page, [completedRun(14100)]);
  await startRun(page);
  await getEveryFact(page, 500);

  await expect(
    page.getByRole('heading', { level: 1, name: '2.4 s off your best' }),
  ).toBeVisible();
  await expect(page.getByText('0:16.5', { exact: true })).toBeVisible();
  await expect(page.getByText('0 missed')).toBeVisible();
  await expect(page.getByText('Your best 0:14.1')).toBeVisible();
  await expect(dragon(page, 'waves')).toBeVisible();
  await expect(breath(page)).toHaveCount(0);
  await expect(sparkles(page)).toHaveCount(0);
  await expect(confetti(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(speedRunButton(page)).toHaveAccessibleDescription('Best 0:14.1');
});

// Hides the app, as switching away from it or locking the iPad does.
async function hideApp(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

function startHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Times tables' });
}

// The one record of a run that was quit with the given tally.
function quitRecord(at: string, fast: number, missed: number): DrillRecord {
  return {
    mode: 'speed',
    at,
    tables: [6, 8, 12],
    fast,
    slow: 0,
    missed,
    quit: true,
    time: null,
  };
}

test('the quit cross returns straight to the Start screen and stores a quit record with no time', async ({
  page,
}) => {
  await page.goto('./');
  await startRun(page);
  const key = await keyOnScreen(page);
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect.poll(() => keyOnScreen(page)).not.toBe(key);

  await page.getByRole('button', { name: 'Quit' }).click();

  await expect(startHeading(page)).toBeVisible();
  await expect(speedRunButton(page)).toHaveAccessibleDescription(
    'all 33 facts, no best yet',
  );
  const { records, facts } = await storedProgress(page);
  expect(records).toEqual([quitRecord('2026-01-01T09:00:04.000Z', 1, 0)]);
  expect(facts[key]).toEqual({ level: 1, fast: 1, slow: 0, missed: 0 });
});

test('quitting from the miss reveal stays on the Start screen', async ({
  page,
}) => {
  await page.goto('./');
  await startRun(page);
  await page.getByRole('button', { name: 'Missed' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('=');

  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(startHeading(page)).toBeVisible();
  await page.clock.runFor(1500);

  await expect(startHeading(page)).toBeVisible();
  const { records } = await storedProgress(page);
  expect(records).toEqual([quitRecord('2026-01-01T09:00:03.000Z', 0, 1)]);
});

test('hiding the app during a run quits it', async ({ page }) => {
  await page.goto('./');
  await startRun(page);
  await page.getByRole('button', { name: 'Got it' }).click();

  await hideApp(page);

  await expect(startHeading(page)).toBeVisible();
  const { records } = await storedProgress(page);
  expect(records).toEqual([quitRecord('2026-01-01T09:00:03.000Z', 1, 0)]);
});

test('hiding the app during the miss reveal quits the run', async ({
  page,
}) => {
  await page.goto('./');
  await startRun(page);
  await page.getByRole('button', { name: 'Missed' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('=');

  await hideApp(page);
  await expect(startHeading(page)).toBeVisible();
  await page.clock.runFor(1500);

  await expect(startHeading(page)).toBeVisible();
  const { records } = await storedProgress(page);
  expect(records).toEqual([quitRecord('2026-01-01T09:00:03.000Z', 0, 1)]);
});

test('hiding the app during the countdown quits the run before it starts', async ({
  page,
}) => {
  await page.goto('./');
  await startCountdown(page);
  await page.clock.runFor(1000);

  await hideApp(page);
  await expect(startHeading(page)).toBeVisible();
  await page.clock.runFor(3000);

  await expect(startHeading(page)).toBeVisible();
  const { records } = await storedProgress(page);
  expect(records).toEqual([quitRecord('2026-01-01T09:00:01.000Z', 0, 0)]);
});

test('hiding the app outside a run leaves no record', async ({ page }) => {
  await page.goto('./');
  await startRun(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(startHeading(page)).toBeVisible();

  await hideApp(page);

  const { records } = await storedProgress(page);
  expect(records).toHaveLength(1);
});

for (const [orientation, width, height] of [
  ['portrait', 820, 1180],
  ['landscape', 1180, 820],
] as const) {
  test(`the run card fits an iPad in ${orientation}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('./');
    await startRun(page);

    const parts = [
      page.getByRole('button', { name: 'Quit' }),
      clock(page),
      page.getByRole('heading', { level: 1 }),
      page.getByRole('button', { name: 'Missed' }),
      page.getByRole('button', { name: 'Got it' }),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });

  test(`the end of a new best fits an iPad in ${orientation}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await openWithRecords(page, [completedRun(20000)]);
    await startRun(page);
    await getEveryFact(page, 500);

    // The dragon is measured once it has puffed up into the pose.
    const proud = dragon(page, 'stands proud');
    await heightAtRest(page, proud);
    const parts = [
      proud,
      page.getByRole('heading', { level: 1, name: 'New best!' }),
      page.getByText('0:16.5', { exact: true }),
      page.getByText('0 missed'),
      page.getByText('Previous best 0:20.0'),
      page.getByRole('button', { name: 'Done' }),
      page.getByRole('button', { name: 'Run again' }),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });

  test(`the end of a run fits an iPad in ${orientation}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openWithRecords(page, [completedRun(14100)]);
    await startRun(page);
    await getEveryFact(page, 500);

    const parts = [
      dragon(page, 'waves'),
      page.getByRole('heading', { level: 1 }),
      page.getByText('0:16.5', { exact: true }),
      page.getByText('0 missed'),
      page.getByText('Your best 0:14.1'),
      page.getByRole('button', { name: 'Done' }),
      page.getByRole('button', { name: 'Run again' }),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });
}
