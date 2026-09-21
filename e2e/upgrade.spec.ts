import { PROGRESS_KEY, BACKUP_KEY } from '../src/storage';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  expectNoTableOn,
  openParent,
  storedProgress,
  practiseButton,
  tile,
} from './helpers';

// A document the version 1 build accepts: a table selection, some levels, a
// drill record and a speed run record.
const VERSION_1 = JSON.stringify({
  version: 1,
  tables: [6],
  facts: {
    '6x7': { level: 4, fast: 12, slow: 3, missed: 2 },
    '8x12': { level: 2, fast: 3, slow: 1, missed: 1 },
  },
  records: [
    {
      mode: 'drill',
      at: '2025-12-31T09:00:00.000Z',
      tables: [6],
      fast: 14,
      slow: 4,
      missed: 2,
      quit: false,
      time: null,
    },
    {
      mode: 'speed',
      at: '2025-12-31T10:00:00.000Z',
      tables: [6, 8, 12],
      fast: 30,
      slow: 2,
      missed: 1,
      quit: false,
      time: 161300,
    },
  ],
});

test('a version 1 document is backed up, the app starts fresh and a drill saves a version 2 document', async ({
  page,
}) => {
  await page.addInitScript(([key, text]) => localStorage.setItem(key, text), [
    PROGRESS_KEY,
    VERSION_1,
  ] as const);
  await page.goto('./');

  await expectNoTableOn(page);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBe(VERSION_1);

  await openParent(page);
  await expect(page.getByText('No practice this week')).toBeVisible();
  await expect(page.getByText('No drills yet')).toBeVisible();
  await expect(page.getByRole('button', { name: /, level 0$/ })).toHaveCount(
    132,
  );
  await page.getByRole('button', { name: 'Back' }).click();

  await tile(page, '6s').click();
  await practiseButton(page).click();
  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  const stored = await storedProgress(page);
  expect(stored.version).toBe(2);
  expect(stored.tables).toEqual([6]);
  // The one right answer, given on the instant, starts the answer times.
  expect(stored.times).toEqual([0]);
  expect(Object.values(stored.facts)).toEqual([
    { level: 1, fast: 1, slow: 0, missed: 0 },
  ]);
  expect(stored.records).toEqual([
    {
      at: '2026-01-01T09:00:00.000Z',
      tables: [6],
      fast: 1,
      slow: 0,
      missed: 0,
      quit: true,
      pace: null,
      known: 0,
      median: 0,
    },
  ]);
});
