import type { Locator, Page } from '@playwright/test';
import { TABLES } from '../src/model/facts';
import type { DrillRecord } from '../src/model/progress';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  getEveryFact,
  openParent,
  openWithRecords,
  startDrill,
  startRun,
  storedProgress,
} from './helpers';

// A grid cell, by its fact and the level it should show.
function cell(page: Page, label: string, level: number): Locator {
  return page.getByRole('button', {
    name: `${label}, level ${level}`,
    exact: true,
  });
}

// A legend swatch, by the level it stands for.
function swatch(page: Page, level: number): Locator {
  return page.getByRole('img', { name: `Level ${level} colour`, exact: true });
}

async function backgroundColor(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor);
}

// The red and green channels of a computed "rgb(r, g, b)" colour.
function redAndGreen(rgb: string): { red: number; green: number } {
  const match = /^rgba?\((\d+), (\d+), (\d+)/.exec(rgb);
  if (!match) throw new Error(`not a colour: ${rgb}`);
  const [, red, green] = match;
  return { red: Number(red), green: Number(green) };
}

// A fact key, such as "6x7", read as the grid's own label for it: the
// table factor first.
function labelOf(key: string): string {
  const [a, b] = key.split('x').map(Number);
  if (a === undefined || b === undefined)
    throw new Error(`bad fact key ${key}`);
  return (TABLES as readonly number[]).includes(a)
    ? `${a} × ${b}`
    : `${b} × ${a}`;
}

test('For parents opens the Parent view on one tap, and Back returns to the Start screen', async ({
  page,
}) => {
  await page.goto('./');
  await openParent(page);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Times tables' }),
  ).toBeVisible();
});

test('a fresh document shows the empty states, an unlevelled grid and the legend', async ({
  page,
}) => {
  await page.goto('./');
  await openParent(page);

  await expect(page.getByText('No practice this week')).toBeVisible();
  await expect(page.getByText('No drills yet')).toBeVisible();
  await expect(page.getByText('No completed speed run yet')).toBeVisible();

  await expect(page.getByRole('button', { name: /, level 0$/ })).toHaveCount(
    36,
  );
  // A cell at level 0 is coloured the same as the legend's level-0 swatch.
  expect(await backgroundColor(cell(page, '6 × 1', 0))).toBe(
    await backgroundColor(swatch(page, 0)),
  );

  await expect(
    page.getByText('0, new or missed', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('1', { exact: true })).toBeVisible();
  await expect(page.getByText('2', { exact: true })).toBeVisible();
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await expect(page.getByText('4, known', { exact: true })).toBeVisible();
  const swatchColors: string[] = [];
  for (let level = 0; level <= 4; level++) {
    await expect(swatch(page, level)).toBeVisible();
    swatchColors.push(await backgroundColor(swatch(page, level)));
  }
  // The five levels are all told apart, and the scale runs red to green.
  expect(new Set(swatchColors)).toHaveProperty('size', 5);
  const [lowest, , , , highest] = swatchColors.map(redAndGreen);
  if (!lowest || !highest) throw new Error('five swatches were checked above');
  expect(lowest.red).toBeGreaterThan(lowest.green);
  expect(highest.green).toBeGreaterThan(highest.red);

  await expect(
    page.getByText(/Version \d+\.\d+\.\d+ \([0-9a-f]{7,}\)/),
  ).toBeVisible();

  // No dragon on this read-only screen.
  await expect(page.getByRole('img', { name: /dragon/i })).toHaveCount(0);

  // Each row groups its twelve cells under an accessible name.
  for (const table of TABLES) {
    await expect(
      page
        .getByRole('group', { name: `${table}s`, exact: true })
        .getByRole('button'),
    ).toHaveCount(12);
  }
});

// A whole drill: 14 fast, 4 slow and 2 missed, the same mix drill.spec.ts
// drives. The 4 slow answers each cost 3 seconds of clock time.
const FULL_DRILL = [
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
] as const;

// Drives a full drill and returns to the Start screen.
async function driveFullDrill(page: Page): Promise<void> {
  await startDrill(page);
  for (const outcome of FULL_DRILL) {
    await answerCard(page, outcome);
    await advance(page);
  }
  await expect(
    page.getByRole('heading', { level: 1, name: 'Drill done!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).click();
}

// 1 fast then 1 missed, then quit: a drill record with 2 answered. Returns
// to the Start screen.
async function driveQuitDrill(page: Page): Promise<void> {
  await startDrill(page);
  await answerCard(page, 'fast');
  await advance(page);
  await answerCard(page, 'missed');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await page.getByRole('button', { name: 'Home' }).click();
}

// Runs a speed run, missing the first `misses` facts (each requeued and
// picked up later, fast) and getting the rest fast straight away, then
// returns to the Start screen. Each miss costs 1.5 seconds of clock time
// for its reveal; each Got it here costs half a second.
async function driveSpeedRun(page: Page, misses: number): Promise<void> {
  await startRun(page);
  for (let i = 0; i < misses; i++) {
    await page.getByRole('button', { name: 'Missed' }).click();
    await page.clock.runFor(1500);
  }
  await getEveryFact(page, 500);
  await page.getByRole('button', { name: 'Done' }).click();
}

test('a mix of drills and a speed run show correctly on the Parent view', async ({
  page,
}) => {
  await page.goto('./');
  await driveFullDrill(page);
  await driveQuitDrill(page);
  await driveSpeedRun(page, 2);

  const stored = await storedProgress(page);
  await openParent(page);

  // Grid colours: for at least one fact at each level the document
  // reached, the cell's colour matches the legend swatch of that level.
  const entries = Object.entries(stored.facts);
  const levelsReached = new Set(entries.map(([, fact]) => fact.level));
  for (const level of levelsReached) {
    const found = entries.find(([, fact]) => fact.level === level);
    if (!found) throw new Error(`no stored fact reached level ${level}`);
    const [key] = found;
    const legendColor = await backgroundColor(swatch(page, level));
    const cellColor = await backgroundColor(cell(page, labelOf(key), level));
    expect(cellColor).toBe(legendColor);
  }

  // An overlap fact shows the same colour and level in both its rows.
  const overlapKeys = ['6x8', '6x12', '8x12'];
  const overlapEntry = entries.find(([key]) => overlapKeys.includes(key));
  if (!overlapEntry) throw new Error('the speed run touches every fact');
  const [overlap, overlapFact] = overlapEntry;
  const [a, b] = overlap.split('x').map(Number);
  expect(
    await backgroundColor(cell(page, `${a} × ${b}`, overlapFact.level)),
  ).toBe(await backgroundColor(cell(page, `${b} × ${a}`, overlapFact.level)));

  // Tap for counts: shows the tapped cell's lifetime counts, clears on a
  // second tap of the same cell, and replaces on a tap of another.
  const [first, second] = entries;
  if (!first || !second) throw new Error('the speed run touches every fact');
  const [firstKey, firstFact] = first;
  const [secondKey, secondFact] = second;
  const status = page.getByRole('status');
  const target = cell(page, labelOf(firstKey), firstFact.level);
  const other = cell(page, labelOf(secondKey), secondFact.level);

  await target.click();
  await expect(status).toHaveText(
    `${labelOf(firstKey)}: fast ${firstFact.fast}, slow ${firstFact.slow}, missed ${firstFact.missed}`,
  );
  await expect(target).toHaveAttribute('aria-pressed', 'true');

  await target.click();
  await expect(status).toHaveText('');
  await expect(target).toHaveAttribute('aria-pressed', 'false');

  await target.click();
  await other.click();
  await expect(status).toHaveText(
    `${labelOf(secondKey)}: fast ${secondFact.fast}, slow ${secondFact.slow}, missed ${secondFact.missed}`,
  );
  await expect(target).toHaveAttribute('aria-pressed', 'false');
  await expect(other).toHaveAttribute('aria-pressed', 'true');

  // The week line: 2 drills (one quit) and 1 speed run all count; facts
  // answered sums fast + slow + missed across them.
  const drillAnswered = 20;
  const quitAnswered = 2;
  const runAnswered = 33 + 2; // every fact once, 2 of them missed first
  const totalAnswered = drillAnswered + quitAnswered + runAnswered;
  const totalFast = 14 + 1 + 33;
  const share = Math.round((totalFast / totalAnswered) * 100);
  await expect(
    page.getByText(
      `This week: 3 drills, ${totalAnswered} facts answered, ${share}% fast`,
    ),
  ).toBeVisible();

  // The recent list: newest first, with the drill, quit and run wording.
  const rows = page.getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toHaveText('Today · Speed run · 0:19.5 · 2 missed');
  await expect(rows.nth(1)).toHaveText(
    'Today · 6s, 8s and 12s · 1 fast · 0 slow · 1 missed · stopped at 2 of 20',
  );
  await expect(rows.nth(2)).toHaveText(
    'Today · 6s, 8s and 12s · 14 fast · 4 slow · 2 missed',
  );

  // The best line: the only completed run, set today.
  await expect(page.getByText('Best 0:19.5, set today')).toBeVisible();
});

test('older history reads with its date wording, and the best line follows the fastest run, not the latest', async ({
  page,
}) => {
  const older: DrillRecord = {
    mode: 'speed',
    at: '2025-12-23T09:00:00.000Z',
    tables: [...TABLES],
    fast: 33,
    slow: 0,
    missed: 0,
    quit: false,
    time: 30000, // the fastest run, so the best
  };
  const quitRun: DrillRecord = {
    mode: 'speed',
    at: '2025-12-29T09:00:00.000Z',
    tables: [...TABLES],
    fast: 10,
    slow: 0,
    missed: 3,
    quit: true,
    time: null,
  };
  const newerSlower: DrillRecord = {
    mode: 'speed',
    at: '2025-12-30T09:00:00.000Z',
    tables: [...TABLES],
    fast: 33,
    slow: 0,
    missed: 0,
    quit: false,
    time: 40000, // newer than `older`, but slower, so not the best
  };
  const yesterday: DrillRecord = {
    mode: 'drill',
    at: '2025-12-31T09:00:00.000Z',
    tables: [6],
    fast: 5,
    slow: 0,
    missed: 0,
    quit: true,
    time: null,
  };
  await openWithRecords(page, [older, quitRun, newerSlower, yesterday]);
  await openParent(page);

  await expect(page.getByText(/^Yesterday ·/)).toBeVisible();
  await expect(
    page.getByText('Tue 30 Dec · Speed run · 0:40.0 · 0 missed'),
  ).toBeVisible();
  await expect(
    page.getByText('Mon 29 Dec · Speed run · stopped · 3 missed'),
  ).toBeVisible();
  await expect(page.getByText(/^Tue 23 Dec ·/)).toBeVisible();

  // The best line follows the fastest completed run (23rd), not the most
  // recent one (30th).
  await expect(page.getByText('Best 0:30.0, set Tue 23 Dec')).toBeVisible();
});

test('a record six days old counts in the week and one seven days old does not', async ({
  page,
}) => {
  const sixDaysOld: DrillRecord = {
    mode: 'drill',
    at: '2025-12-26T09:00:00.000Z',
    tables: [6],
    fast: 1,
    slow: 0,
    missed: 0,
    quit: false,
    time: null,
  };
  const sevenDaysOld: DrillRecord = {
    mode: 'drill',
    at: '2025-12-25T09:00:00.000Z',
    tables: [6],
    fast: 1,
    slow: 0,
    missed: 0,
    quit: false,
    time: null,
  };
  await openWithRecords(page, [sevenDaysOld, sixDaysOld]);
  await openParent(page);

  await expect(
    page.getByText('This week: 1 drill, 1 fact answered, 100% fast'),
  ).toBeVisible();
});

test('only the ten most recent records show, newest first', async ({
  page,
}) => {
  const records: DrillRecord[] = Array.from({ length: 12 }, (_, i) => ({
    mode: 'drill',
    at: `2025-12-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`,
    tables: [6],
    fast: i + 1,
    slow: 0,
    missed: 0,
    quit: false,
    time: null,
  }));
  await openWithRecords(page, records);
  await openParent(page);

  const rows = page.getByRole('listitem');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('12 fast');
  await expect(rows.last()).toContainText('3 fast');
});

for (const [orientation, width, height] of [
  ['portrait', 768, 1024],
  ['landscape', 1024, 768],
] as const) {
  test(`the grid's twelve cells per row fit an iPad in ${orientation} with no horizontal scrolling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('./');
    await openParent(page);

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(width);

    for (const label of ['6 × 1', '6 × 12', '8 × 1', '12 × 1']) {
      await expect(cell(page, label, 0)).toBeInViewport({ ratio: 1 });
    }
  });
}
