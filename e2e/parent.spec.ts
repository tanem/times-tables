import type { Locator, Page } from '@playwright/test';
import { OFFERED_TABLES } from '../src/model/facts';
import type { DrillRecord } from '../src/model/progress';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  openParent,
  openWithRecords,
  PACE_TIMES,
  startDrill,
  startHeading,
  storedProgress,
} from './helpers';

// A grid cell, by its fact and the level it should show.
function cell(page: Page, label: string, level: number): Locator {
  return page.getByRole('button', {
    name: `${label}, level ${level}`,
    exact: true,
  });
}

// One of the trend's three figures, by its label.
function figure(page: Page, label: string): Locator {
  return page.getByRole('group', { name: label, exact: true });
}

// The chart of pace under the figures.
function chart(page: Page): Locator {
  return page.getByRole('img', { name: 'Pace drill by drill' });
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
  return (OFFERED_TABLES as readonly number[]).includes(a)
    ? `${a} × ${b}`
    : `${b} × ${a}`;
}

test('For parents opens the Parent view on one tap, and Back returns to the Start screen', async ({
  page,
}) => {
  await page.goto('./');
  await openParent(page);

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(startHeading(page)).toBeVisible();
});

test('a fresh document shows the empty states, an unlevelled grid and the legend', async ({
  page,
}) => {
  await page.goto('./');
  await openParent(page);

  await expect(page.getByText('No practice this week')).toBeVisible();
  await expect(page.getByText('No drills yet')).toBeVisible();
  await expect(page.getByText(/speed run/i)).toHaveCount(0);

  // No trend yet: one line says when it shows, with no figures or chart.
  await expect(
    page.getByText('A trend shows here once there is practice to compare.'),
  ).toBeVisible();
  await expect(figure(page, 'Pace')).toHaveCount(0);
  await expect(chart(page)).toHaveCount(0);

  await expect(page.getByRole('button', { name: /, level 0$/ })).toHaveCount(
    36,
  );
  // The grid is a multiplication square: a cell shows its product.
  await expect(cell(page, '6 × 7', 0)).toHaveText('42');
  await expect(cell(page, '12 × 12', 0)).toHaveText('144');
  // A cell at level 0 is coloured the same as the legend's level-0 swatch.
  expect(await backgroundColor(cell(page, '6 × 1', 0))).toBe(
    await backgroundColor(swatch(page, 0)),
  );

  const legend = page.getByRole('group', { name: 'Levels', exact: true });
  for (const label of ['0, new or missed', '1', '2', '3', '4, known']) {
    await expect(legend.getByText(label, { exact: true })).toBeVisible();
  }
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
  for (const table of OFFERED_TABLES) {
    await expect(
      page
        .getByRole('group', { name: `${table}s`, exact: true })
        .getByRole('button'),
    ).toHaveCount(12);
  }
});

// A whole drill: 14 fast, 4 slow and 2 missed, the same mix drill.spec.ts
// drives. The 4 slow answers each cost 3 seconds of clock time, and they
// need a pace to be graded against, so the drill opens on PACE_TIMES.
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
  await startDrill(page, PACE_TIMES);
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

test('a full drill and a quit drill show correctly on the Parent view', async ({
  page,
}) => {
  await page.goto('./');
  await driveFullDrill(page);
  await driveQuitDrill(page);

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
  if (!overlapEntry) throw new Error('the drills reach an overlap fact');
  const [overlap, overlapFact] = overlapEntry;
  const [a, b] = overlap.split('x').map(Number);
  expect(
    await backgroundColor(cell(page, `${a} × ${b}`, overlapFact.level)),
  ).toBe(await backgroundColor(cell(page, `${b} × ${a}`, overlapFact.level)));

  // Tap for counts: shows the tapped cell's lifetime counts, clears on a
  // second tap of the same cell, and replaces on a tap of another.
  const [first, second] = entries;
  if (!first || !second) throw new Error('the drills reach two facts');
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

  // The figures show from the first drill. The pace is the one second the
  // drill opened on, and nothing is four weeks old.
  await expect(figure(page, 'Pace')).toContainText('1.0 s');
  await expect(figure(page, 'Pace')).toContainText('nothing to compare yet');
  await expect(figure(page, 'Facts known')).toContainText('0 of 33');
  await expect(figure(page, 'Fast answers')).toContainText('68%');

  // The week line: both drills count, the quit one too; facts answered
  // sums fast + slow + missed across them: 20 + 2, of which 14 + 1 fast.
  await expect(
    page.getByText('This week: 2 drills, 22 facts answered, 68% fast'),
  ).toBeVisible();

  // The recent list: newest first, with the drill and quit wording.
  const rows = page.getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveText(
    'Today · 6s, 8s and 12s · 1 fast · 0 slow · 1 missed · stopped at 2 of 20',
  );
  await expect(rows.nth(1)).toHaveText(
    'Today · 6s, 8s and 12s · 14 fast · 4 slow · 2 missed',
  );
});

// A finished drill on the 6s with the figures the trend reads.
function trendRecord(
  at: string,
  pace: number | null,
  known: number,
  fast: number,
  tables: DrillRecord['tables'] = [6],
): DrillRecord {
  return {
    at,
    tables,
    fast,
    slow: 20 - fast,
    missed: 0,
    quit: false,
    pace,
    known,
    median: pace,
  };
}

test('weeks of practice show as figures against four weeks ago over a chart of pace', async ({
  page,
}) => {
  await openWithRecords(
    page,
    [
      // 30 days before the fixed date: inside the earlier week.
      trendRecord('2025-12-02T09:00:00.000Z', 5200, 3, 10),
      trendRecord('2025-12-10T09:00:00.000Z', 4800, 5, 12),
      trendRecord('2025-12-18T09:00:00.000Z', 4100, 8, 14, [6, 8]),
      trendRecord('2025-12-26T09:00:00.000Z', 3500, 10, 15, [6, 8]),
      trendRecord('2026-01-01T09:00:00.000Z', 3000, 12, 17, [6, 8]),
    ],
    PACE_TIMES,
  );
  await openParent(page);

  await expect(figure(page, 'Pace')).toContainText('3.0 s');
  await expect(figure(page, 'Pace')).toContainText('5.2 s four weeks ago');
  await expect(figure(page, 'Facts known')).toContainText('12 of 33');
  await expect(figure(page, 'Facts known')).toContainText('3 four weeks ago');
  await expect(figure(page, 'Fast answers')).toContainText('80%');
  await expect(figure(page, 'Fast answers')).toContainText(
    '50% four weeks ago',
  );

  await expect(chart(page)).toBeVisible();
  await expect(page.getByText('8s added')).toBeVisible();
  await expect(page.getByText('4 weeks ago', { exact: true })).toBeVisible();
  await expect(page.getByText('highest 5.2 s')).toBeVisible();
  await expect(page.getByText('Today', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/^Pace is the usual time to answer/),
  ).toBeVisible();
  await expect(page.getByText(/No pace yet/)).toHaveCount(0);
});

test('early practice shows the figures with nothing to compare, and no chart', async ({
  page,
}) => {
  await openWithRecords(
    page,
    [
      trendRecord('2025-12-30T09:00:00.000Z', null, 0, 4),
      trendRecord('2026-01-01T09:00:00.000Z', null, 0, 3),
    ],
    [2000, 2100, 1900, 2000, 2050, 1950, 2000],
  );
  await openParent(page);

  await expect(
    page.getByText('No pace yet: it starts after 20 right answers (7 so far).'),
  ).toBeVisible();
  for (const label of ['Pace', 'Facts known', 'Fast answers']) {
    await expect(figure(page, label)).toContainText('nothing to compare yet');
  }
  await expect(chart(page)).toHaveCount(0);
});

test('older history reads with its date wording', async ({ page }) => {
  const older: DrillRecord = {
    at: '2025-12-23T10:00:00.000Z',
    tables: [8],
    fast: 12,
    slow: 5,
    missed: 3,
    quit: false,
    pace: null,
    known: 0,
    median: null,
  };
  const yesterday: DrillRecord = {
    at: '2025-12-31T09:00:00.000Z',
    tables: [6],
    fast: 5,
    slow: 0,
    missed: 0,
    quit: true,
    pace: null,
    known: 0,
    median: null,
  };
  await openWithRecords(page, [older, yesterday]);
  await openParent(page);

  const rows = page.getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveText(
    'Yesterday · 6s · 5 fast · 0 slow · 0 missed · stopped at 5 of 20',
  );
  await expect(rows.nth(1)).toHaveText(
    'Tue 23 Dec · 8s · 12 fast · 5 slow · 3 missed',
  );

  // The week holds yesterday's drill alone.
  await expect(
    page.getByText('This week: 1 drill, 5 facts answered, 100% fast'),
  ).toBeVisible();
});

test('a record six days old counts in the week and one seven days old does not', async ({
  page,
}) => {
  const sixDaysOld: DrillRecord = {
    at: '2025-12-26T09:00:00.000Z',
    tables: [6],
    fast: 1,
    slow: 0,
    missed: 0,
    quit: false,
    pace: null,
    known: 0,
    median: null,
  };
  const sevenDaysOld: DrillRecord = {
    at: '2025-12-25T09:00:00.000Z',
    tables: [6],
    fast: 1,
    slow: 0,
    missed: 0,
    quit: false,
    pace: null,
    known: 0,
    median: null,
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
    at: `2025-12-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`,
    tables: [6],
    fast: i + 1,
    slow: 0,
    missed: 0,
    quit: false,
    pace: null,
    known: 0,
    median: null,
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
