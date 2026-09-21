import type { Locator, Page } from '@playwright/test';
import { OFFERED_TABLES } from '../src/model/facts';
import type { Outcome } from '../src/model/level';
import type { Progress } from '../src/model/progress';
import { PROGRESS_KEY } from '../src/storage';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  confetti,
  dragon,
  factOnScreen,
  keyOnScreen,
  sparkles,
  startDrill,
  storedProgress,
} from './helpers';

// The feedback's button for owning up to a wrong answer.
function correction(page: Page): Locator {
  return page.getByRole('button', { name: 'Oops, I was wrong' });
}

// How tall the learner sees the part, in pixels.
async function heightOf(part: Locator): Promise<number> {
  const box = await part.boundingBox();
  if (!box) throw new Error('the part is not laid out');
  return box.height;
}

test('Practise shows the first fact at once with the bar, the position and both buttons', async ({
  page,
}) => {
  await startDrill(page);

  const { x, y } = await factOnScreen(page);
  const tables: readonly number[] = OFFERED_TABLES;
  expect(tables.includes(x) || tables.includes(y)).toBe(true);
  await expect(
    page.getByRole('progressbar', { name: 'Time left' }),
  ).toBeVisible();
  await expect(page.getByText('1 / 20')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Missed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quit' })).toBeVisible();
});

test('the answer is hidden on the card and shown on the feedback', async ({
  page,
}) => {
  await startDrill(page);
  const { x, y } = await factOnScreen(page);
  await expect(page.getByText(String(x * y), { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `${x} × ${y} = ${x * y}` }),
  ).toBeVisible();
  await expect(page.getByText('Fast!')).toBeVisible();
});

test('the feedback moves on by itself after 2 seconds or on a tap', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');

  await page.clock.runFor(1999);
  await expect(page.getByText('Fast!')).toBeVisible();
  await page.clock.runFor(1);
  await expect(page.getByText('2 / 20')).toBeVisible();

  await answerCard(page, 'fast');
  await advance(page);
  await expect(page.getByText('3 / 20')).toBeVisible();
});

test('after the bar drains Got it turns amber, the caption says time is up and Got it means slow', async ({
  page,
}) => {
  await startDrill(page);
  const got = page.getByRole('button', { name: 'Got it' });
  const bar = page.getByRole('progressbar', { name: 'Time left' });
  await expect(got).toHaveCSS('background-color', 'rgb(47, 158, 68)');
  await expect(page.getByText('Time is up')).toHaveCount(0);

  await page.clock.runFor(3000);
  await expect(bar).toHaveAttribute('aria-valuenow', '0');
  await expect(
    page.getByText('Time is up. Still say it, then tap.'),
  ).toBeVisible();
  await expect(got).toHaveCSS('background-color', 'rgb(227, 154, 30)');

  await got.click();
  await expect(page.getByText('Got there!')).toBeVisible();
});

test('a miss shows the answer with a word and holds 2.5 seconds', async ({
  page,
}) => {
  await startDrill(page);
  const { x, y } = await factOnScreen(page);
  await page.getByRole('button', { name: 'Missed' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: `${x} × ${y} = ${x * y}` }),
  ).toBeVisible();
  await expect(page.getByText('Next time')).toBeVisible();
  await page.clock.runFor(2499);
  await expect(page.getByText('Next time')).toBeVisible();
  await page.clock.runFor(1);
  await expect(page.getByText('2 / 20')).toBeVisible();
});

test('on fast the dragon is the biggest thing on screen, jumps and bursts with sparkles', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');

  await expect(dragon(page, 'jumps')).toBeVisible();
  await expect(sparkles(page)).toBeVisible();
  const dragonHeight = await heightOf(dragon(page, 'jumps'));
  const sum = page.getByRole('heading', { level: 1 });
  expect(dragonHeight).toBeGreaterThan(2 * (await heightOf(sum)));
  expect(dragonHeight).toBeGreaterThan(
    2 * (await heightOf(page.getByText('Fast!'))),
  );

  // The burst fades and goes while the feedback is still up.
  await page.clock.runFor(1300);
  await expect(sparkles(page)).toHaveCount(0);
  await expect(page.getByText('Fast!')).toBeVisible();
});

test('on slow the dragon nods with no sparkles', async ({ page }) => {
  await startDrill(page);
  await answerCard(page, 'slow');

  await expect(dragon(page, 'nods')).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);
});

test('on missed the fact and answer are the biggest thing on screen and the dragon shrugs small in the top corner', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'missed');

  const shrugging = dragon(page, 'shrugs');
  await expect(shrugging).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);

  const sumBox = await page.getByRole('heading', { level: 1 }).boundingBox();
  const dragonBox = await shrugging.boundingBox();
  const viewport = page.viewportSize();
  if (!sumBox || !dragonBox || !viewport) throw new Error('not laid out');
  expect(sumBox.height).toBeGreaterThan(dragonBox.height);
  expect(sumBox.width).toBeGreaterThan(3 * dragonBox.width);
  // The top right corner, clear of the sum.
  expect(dragonBox.x).toBeGreaterThan(viewport.width / 2);
  expect(dragonBox.y + dragonBox.height).toBeLessThan(sumBox.y);
});

test('the words rotate through each outcome’s set', async ({ page }) => {
  await startDrill(page);
  for (const word of ['Fast!', 'Zoom!', 'Yes!', 'Fast!']) {
    await answerCard(page, 'fast');
    await expect(page.getByText(word)).toBeVisible();
    await advance(page);
  }
  for (const word of ['Next time', 'Tricky one']) {
    await answerCard(page, 'missed');
    await expect(page.getByText(word)).toBeVisible();
    await advance(page);
  }
});

test('the streak shows from the second fast answer in a row and goes after a slow or a miss', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');
  await expect(page.getByText('in a row')).toHaveCount(0);
  await advance(page);

  await answerCard(page, 'fast');
  await expect(page.getByText('2 in a row')).toBeVisible();
  await advance(page);

  await answerCard(page, 'fast');
  await expect(page.getByText('3 in a row')).toBeVisible();
  await advance(page);

  await answerCard(page, 'missed');
  await expect(page.getByText('in a row')).toHaveCount(0);
  await advance(page);

  await answerCard(page, 'fast');
  await expect(page.getByText('in a row')).toHaveCount(0);
  await advance(page);

  await answerCard(page, 'fast');
  await expect(page.getByText('2 in a row')).toBeVisible();
  await advance(page);

  await answerCard(page, 'slow');
  await expect(page.getByText('in a row')).toHaveCount(0);
});

// A whole drill: 14 fast, 4 slow and 2 missed, with the best streak of 5 in
// the middle.
const FULL_DRILL: Outcome[] = [
  'fast',
  'fast',
  'slow',
  'fast',
  'missed',
  'fast',
  'fast',
  'fast',
  'fast',
  'fast',
  'slow',
  'fast',
  'fast',
  'missed',
  'fast',
  'slow',
  'fast',
  'fast',
  'slow',
  'fast',
];

test('after 20 presentations the end screen shows the heading, the tally and the best streak', async ({
  page,
}) => {
  await startDrill(page);
  const shown: string[] = [];
  for (const [index, outcome] of FULL_DRILL.entries()) {
    await expect(page.getByText(`${index + 1} / 20`)).toBeVisible();
    const { x, y } = await factOnScreen(page);
    const key = `${Math.min(x, y)}x${Math.max(x, y)}`;
    // No fact comes back within three presentations of itself.
    expect(shown.slice(-3)).not.toContain(key);
    shown.push(key);
    await answerCard(page, outcome);
    await advance(page);
  }

  await expect(
    page.getByRole('heading', { level: 1, name: 'Drill done!' }),
  ).toBeVisible();
  await expect(page.getByText('14 Fast')).toBeVisible();
  await expect(page.getByText('4 Slow')).toBeVisible();
  await expect(page.getByText('2 Missed')).toBeVisible();
  await expect(page.getByText('Best streak: 5')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go again' })).toBeVisible();

  const stored = await storedProgress(page);
  expect(stored.records).toEqual([
    {
      // The fixed date plus the four slow answers' 3 seconds each.
      at: '2026-01-01T09:00:12.000Z',
      tables: [6, 8, 12],
      fast: 14,
      slow: 4,
      missed: 2,
      quit: false,
      // The learner still answers aloud, so there are no answer times.
      pace: null,
      known: 0,
      median: null,
    },
  ]);
  const facts = Object.values(stored.facts);
  expect(facts.reduce((sum, fact) => sum + fact.fast, 0)).toBe(14);
  expect(facts.reduce((sum, fact) => sum + fact.slow, 0)).toBe(4);
  expect(facts.reduce((sum, fact) => sum + fact.missed, 0)).toBe(2);
});

// Runs a whole drill with the given number of fast answers and the rest
// missed, and lands on the end screen.
async function finishDrill(page: Page, fast: number): Promise<void> {
  await startDrill(page);
  for (let index = 0; index < 20; index++) {
    await answerCard(page, index < fast ? 'fast' : 'missed');
    await advance(page);
  }
  await expect(
    page.getByRole('heading', { level: 1, name: 'Drill done!' }),
  ).toBeVisible();
}

test('a drill with 15 fast answers ends with confetti and a big jump', async ({
  page,
}) => {
  await finishDrill(page, 15);

  await expect(dragon(page, 'jumps high')).toBeVisible();
  await expect(confetti(page)).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);

  // The confetti falls once and goes.
  await page.clock.runFor(2400);
  await expect(confetti(page)).toHaveCount(0);
  await expect(dragon(page, 'jumps high')).toBeVisible();
});

for (const fast of [14, 8]) {
  test(`a drill with ${fast} fast answers ends with sparkles and a hop`, async ({
    page,
  }) => {
    await finishDrill(page, fast);

    await expect(dragon(page, 'hops')).toBeVisible();
    await expect(sparkles(page)).toBeVisible();
    await expect(confetti(page)).toHaveCount(0);
  });
}

test('a drill with 7 fast answers ends with a warm wave', async ({ page }) => {
  await finishDrill(page, 7);

  await expect(dragon(page, 'waves')).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);
  await expect(confetti(page)).toHaveCount(0);
});

test('a quit drill ends with a warm wave however many answers were fast', async ({
  page,
}) => {
  await startDrill(page);
  for (let index = 0; index < 15; index++) {
    await answerCard(page, 'fast');
    await advance(page);
  }
  await page.getByRole('button', { name: 'Quit' }).click();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Stopped early. Still counts!',
    }),
  ).toBeVisible();
  await expect(dragon(page, 'waves')).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);
  await expect(confetti(page)).toHaveCount(0);
});

test('the stored document holds the updated level and counts after each answer', async ({
  page,
}) => {
  await startDrill(page);
  const first = await factOnScreen(page);
  const key = `${Math.min(first.x, first.y)}x${Math.max(first.x, first.y)}`;
  await answerCard(page, 'fast');
  expect((await storedProgress(page)).facts[key]).toEqual({
    level: 1,
    fast: 1,
    slow: 0,
    missed: 0,
  });
  expect((await storedProgress(page)).records).toEqual([]);
});

test('quitting from the card ends the drill with the answers given so far', async ({
  page,
}) => {
  await startDrill(page);
  for (const outcome of ['fast', 'fast', 'missed'] as const) {
    await answerCard(page, outcome);
    await advance(page);
  }
  await page.getByRole('button', { name: 'Quit' }).click();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Stopped early. Still counts!',
    }),
  ).toBeVisible();
  await expect(page.getByText('2 Fast')).toBeVisible();
  await expect(page.getByText('0 Slow')).toBeVisible();
  await expect(page.getByText('1 Missed')).toBeVisible();
  await expect(page.getByText('Best streak: 2')).toBeVisible();

  const stored = await storedProgress(page);
  expect(stored.records).toHaveLength(1);
  expect(stored.records[0]).toMatchObject({
    fast: 2,
    slow: 0,
    missed: 1,
    quit: true,
  });
});

// Opens a drill on the 6s with two facts at level 4 from outside the offered
// tables, which the drill never presents, and every fact of the 6s one fast
// answer from level 4.
async function startDrillNearLevel4(page: Page): Promise<void> {
  const atLevel4 = { level: 4, fast: 4, slow: 0, missed: 0 } as const;
  const atLevel3 = { level: 3, fast: 3, slow: 0, missed: 0 } as const;
  const facts: Progress['facts'] = { '3x5': atLevel4, '4x9': atLevel4 };
  for (let n = 1; n <= 12; n++) {
    facts[`${Math.min(6, n)}x${Math.max(6, n)}`] = atLevel3;
  }
  const progress: Progress = {
    version: 2,
    tables: [6],
    facts,
    times: [],
    records: [],
  };
  await page.addInitScript(([key, text]) => localStorage.setItem(key, text), [
    PROGRESS_KEY,
    JSON.stringify(progress),
  ] as const);
  await startDrill(page);
}

test('a drill record holds the number of facts at level 4 as the drill ended', async ({
  page,
}) => {
  await startDrillNearLevel4(page);

  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  const stored = await storedProgress(page);
  expect(stored.records).toHaveLength(1);
  expect(stored.records[0]).toMatchObject({ quit: true, known: 3 });
});

test('a fact corrected to missed does not count as known in the drill record', async ({
  page,
}) => {
  await startDrillNearLevel4(page);

  await answerCard(page, 'fast');
  await correction(page).click();
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  const stored = await storedProgress(page);
  expect(stored.records).toHaveLength(1);
  expect(stored.records[0]).toMatchObject({ missed: 1, known: 2 });
});

test('Go again starts a new drill on the same tables and Home returns to the Start screen', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: '12s' }).click();
  await page.getByRole('button', { name: 'Practise', exact: true }).click();
  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  await page.getByRole('button', { name: 'Go again' }).click();
  await expect(page.getByText('1 / 20')).toBeVisible();
  const { x, y } = await factOnScreen(page);
  expect(x !== 12 && y !== 12).toBe(true);
  await page.getByRole('button', { name: 'Quit' }).click();
  expect((await storedProgress(page)).records.map((r) => r.tables)).toEqual([
    [6, 8],
    [6, 8],
  ]);

  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByText('Which tables?')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '12s', pressed: false }),
  ).toBeVisible();
});

test('progress survives a reload', async ({ page }) => {
  await startDrill(page);
  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  await page.reload();
  await page.getByRole('button', { name: 'Practise', exact: true }).click();
  await answerCard(page, 'missed');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  const stored = await storedProgress(page);
  expect(stored.records).toHaveLength(2);
  const facts = Object.values(stored.facts);
  expect(facts.reduce((sum, fact) => sum + fact.fast, 0)).toBe(1);
  expect(facts.reduce((sum, fact) => sum + fact.missed, 0)).toBe(1);
});

test('a drill carries on after a write that throws', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('storage is full');
    };
  });
  await startDrill(page);
  await answerCard(page, 'fast');
  await advance(page);
  await answerCard(page, 'fast');
  await expect(page.getByText('2 in a row')).toBeVisible();
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByText('2 Fast')).toBeVisible();
});

test('the correction button shows on fast and slow feedback and not on missed', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');
  await expect(correction(page)).toBeVisible();
  await advance(page);

  await answerCard(page, 'slow');
  await expect(correction(page)).toBeVisible();
  await advance(page);

  await answerCard(page, 'missed');
  await expect(page.getByText('Next time')).toBeVisible();
  await expect(correction(page)).toHaveCount(0);
});

test('correcting a fast answer shows the missed feedback for the same fact and holds 2.5 seconds', async ({
  page,
}) => {
  await startDrill(page);
  const { x, y } = await factOnScreen(page);
  const key = await keyOnScreen(page);
  await answerCard(page, 'fast');
  await expect(page.getByText('Fast!')).toBeVisible();

  await correction(page).click();
  await expect(
    page.getByRole('heading', { level: 1, name: `${x} × ${y} = ${x * y}` }),
  ).toBeVisible();
  await expect(page.getByText('Next time')).toBeVisible();
  await expect(correction(page)).toHaveCount(0);
  expect((await storedProgress(page)).facts[key]).toEqual({
    level: 0,
    fast: 0,
    slow: 0,
    missed: 1,
  });

  // The fast feedback's own 2-second move-on no longer fires.
  await page.clock.runFor(2499);
  await expect(page.getByText('Next time')).toBeVisible();
  await page.clock.runFor(1);
  await expect(page.getByText('2 / 20')).toBeVisible();

  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByText('0 Fast')).toBeVisible();
  await expect(page.getByText('0 Slow')).toBeVisible();
  await expect(page.getByText('1 Missed')).toBeVisible();
  expect((await storedProgress(page)).records[0]).toMatchObject({
    fast: 0,
    slow: 0,
    missed: 1,
  });
});

test('correcting a slow answer counts it as missed in the tally and the stored fact', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');
  await advance(page);
  const key = await keyOnScreen(page);
  await answerCard(page, 'slow');
  await expect(page.getByText('Got there!')).toBeVisible();

  await correction(page).click();
  await expect(page.getByText('Next time')).toBeVisible();
  expect((await storedProgress(page)).facts[key]).toEqual({
    level: 0,
    fast: 0,
    slow: 0,
    missed: 1,
  });
  await advance(page);

  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByText('1 Fast')).toBeVisible();
  await expect(page.getByText('0 Slow')).toBeVisible();
  await expect(page.getByText('1 Missed')).toBeVisible();
  expect((await storedProgress(page)).records[0]).toMatchObject({
    fast: 1,
    slow: 0,
    missed: 1,
  });
});

test('a correction on the third fast in a row leaves the best streak at 2', async ({
  page,
}) => {
  await startDrill(page);
  for (const _ of [1, 2]) {
    await answerCard(page, 'fast');
    await advance(page);
  }
  await answerCard(page, 'fast');
  await expect(page.getByText('3 in a row')).toBeVisible();

  await correction(page).click();
  await expect(page.getByText('in a row')).toHaveCount(0);
  await advance(page);

  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByText('2 Fast')).toBeVisible();
  await expect(page.getByText('1 Missed')).toBeVisible();
  await expect(page.getByText('Best streak: 2')).toBeVisible();
});

for (const [orientation, width, height] of [
  ['portrait', 820, 1180],
  ['landscape', 1180, 820],
] as const) {
  test(`the card fits an iPad in ${orientation}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await startDrill(page);

    const parts = [
      page.getByRole('button', { name: 'Quit' }),
      page.getByText('1 / 20'),
      page.getByRole('heading', { level: 1 }),
      page.getByRole('progressbar', { name: 'Time left' }),
      page.getByRole('button', { name: 'Missed' }),
      page.getByRole('button', { name: 'Got it' }),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });

  test(`the feedback fits an iPad in ${orientation}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await startDrill(page);
    await answerCard(page, 'fast');

    const parts = [
      page.getByRole('heading', { level: 1 }),
      dragon(page, 'jumps'),
      page.getByText('Fast!'),
      page.getByText('Tap to go on'),
      correction(page),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });

  test(`the missed feedback fits an iPad in ${orientation}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await startDrill(page);
    await answerCard(page, 'missed');

    const parts = [
      page.getByRole('heading', { level: 1 }),
      dragon(page, 'shrugs'),
      page.getByText('Next time'),
      page.getByText('Tap to go on'),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });

  test(`the end of a drill fits an iPad in ${orientation}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await startDrill(page);
    await page.getByRole('button', { name: 'Quit' }).click();

    const parts = [
      dragon(page, 'waves'),
      page.getByRole('heading', { level: 1 }),
      page.getByText('0 Fast'),
      page.getByText('Best streak: 0'),
      page.getByRole('button', { name: 'Home' }),
      page.getByRole('button', { name: 'Go again' }),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });
}
