import type { Page } from '@playwright/test';
import { PROGRESS_KEY } from '../src/storage';
import { expect, test } from './fixtures';

const TABLES = [6, 8, 12];

// The fact on the card or the feedback, read the way the learner reads it.
async function factOnScreen(page: Page): Promise<{ x: number; y: number }> {
  const heading = page.getByRole('heading', { level: 1 });
  const text = (await heading.textContent()) ?? '';
  const match = /^(\d+) × (\d+)/.exec(text);
  if (!match) throw new Error(`no fact on screen, saw "${text}"`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

async function startDrill(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'Practise', exact: true }).click();
}

type Outcome = 'fast' | 'slow' | 'missed';

// Answers the card the given way and lands on the feedback.
async function answerCard(page: Page, outcome: Outcome): Promise<void> {
  if (outcome === 'slow') await page.clock.runFor(3000);
  const button = outcome === 'missed' ? 'Missed' : 'Got it';
  await page.getByRole('button', { name: button }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('=');
}

// Taps the feedback to move on.
async function advance(page: Page): Promise<void> {
  await page.getByText('Tap to go on').click();
}

async function storedProgress(page: Page): Promise<{
  facts: Record<
    string,
    { level: number; fast: number; slow: number; missed: number }
  >;
  records: {
    mode: string;
    tables: number[];
    fast: number;
    slow: number;
    missed: number;
    quit: boolean;
    time: number | null;
    at: string;
  }[];
}> {
  const text = await page.evaluate(
    (key) => localStorage.getItem(key),
    PROGRESS_KEY,
  );
  if (text === null) throw new Error('nothing stored');
  return JSON.parse(text);
}

test('Practise shows the first fact at once with the bar, the position and both buttons', async ({
  page,
}) => {
  await startDrill(page);

  const { x, y } = await factOnScreen(page);
  expect(TABLES.includes(x) || TABLES.includes(y)).toBe(true);
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
  for (const [index, outcome] of FULL_DRILL.entries()) {
    await expect(page.getByText(`${index + 1} / 20`)).toBeVisible();
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
      mode: 'drill',
      // The fixed date plus the four slow answers' 3 seconds each.
      at: '2026-01-01T09:00:12.000Z',
      tables: [6, 8, 12],
      fast: 14,
      slow: 4,
      missed: 2,
      quit: false,
      time: null,
    },
  ]);
  const facts = Object.values(stored.facts);
  expect(facts.reduce((sum, fact) => sum + fact.fast, 0)).toBe(14);
  expect(facts.reduce((sum, fact) => sum + fact.slow, 0)).toBe(4);
  expect(facts.reduce((sum, fact) => sum + fact.missed, 0)).toBe(2);
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
    await expect(page.locator('html')).toHaveJSProperty('scrollHeight', height);
  });
}
