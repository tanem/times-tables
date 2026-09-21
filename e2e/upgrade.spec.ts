import { PROGRESS_KEY, BACKUP_KEY } from '../src/storage';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  expectNoTableOn,
  factOnScreen,
  openParent,
  startHeading,
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

test('a version 1 document is backed up, the app starts fresh and a drill saves a version 3 document', async ({
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
  expect(stored.version).toBe(3);
  // The one fast answer took its fact to level 1 for the first time.
  expect(stored.gems).toBe(1);
  expect(stored.character).toBe('dragon');
  expect(stored.tables).toEqual([6]);
  // The one right answer, given on the instant, starts the answer times.
  expect(stored.times).toEqual([0]);
  expect(Object.values(stored.facts)).toEqual([
    { level: 1, best: 1, fast: 1, slow: 0, missed: 0 },
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

// A document the version 2 build accepts: the 6s on, every fact of the 6s at
// level 2, one fact known from outside them, answer times and a drill record.
const VERSION_2_RECORD = {
  at: '2025-12-31T09:00:00.000Z',
  tables: [6],
  fast: 14,
  slow: 4,
  missed: 2,
  quit: false,
  pace: 2400,
  known: 1,
  median: 2200,
};

function version2Facts(): Record<string, object> {
  const facts: Record<string, object> = {
    '3x5': { level: 4, fast: 6, slow: 0, missed: 0 },
  };
  for (let n = 1; n <= 12; n++) {
    facts[`${Math.min(6, n)}x${Math.max(6, n)}`] = {
      level: 2,
      fast: 2,
      slow: 0,
      missed: 0,
    };
  }
  return facts;
}

const VERSION_2 = JSON.stringify({
  version: 2,
  tables: [6],
  facts: version2Facts(),
  times: [2600, 2200],
  records: [VERSION_2_RECORD],
});

test('a version 2 document is migrated with its levels kept and back-paid in gems, and a drill pays from there', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(([key, text]) => localStorage.setItem(key, text), [
    PROGRESS_KEY,
    VERSION_2,
  ] as const);
  await page.goto('./');

  // The migrated document is written back at launch, with no backup.
  await expect(tile(page, '6s')).toHaveAttribute('aria-pressed', 'true');
  const migrated = await storedProgress(page);
  expect(migrated.version).toBe(3);
  expect(migrated.tables).toEqual([6]);
  // One fact at level 4 and twelve at level 2.
  expect(migrated.gems).toBe(28);
  expect(migrated.character).toBe('dragon');
  expect(migrated.facts['3x5']).toEqual({
    level: 4,
    best: 4,
    fast: 6,
    slow: 0,
    missed: 0,
  });
  expect(migrated.facts['6x7']).toEqual({
    level: 2,
    best: 2,
    fast: 2,
    slow: 0,
    missed: 0,
  });
  expect(migrated.times).toEqual([2600, 2200]);
  expect(migrated.records).toEqual([VERSION_2_RECORD]);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBeNull();

  await openParent(page);
  // The twelve cells of the 6s row, and the 6 column of the ten other rows.
  await expect(page.getByRole('button', { name: /, level 2$/ })).toHaveCount(
    22,
  );
  await page.getByRole('button', { name: 'Back' }).click();

  // A fast answer takes its fact to level 3 for the first time and pays a
  // gem.
  await practiseButton(page).click();
  const { x, y } = await factOnScreen(page);
  const factKey = `${Math.min(x, y)}x${Math.max(x, y)}`;
  await answerCard(page, 'fast');
  const paid = await storedProgress(page);
  expect(paid.gems).toBe(29);
  expect(paid.facts[factKey]).toMatchObject({ level: 3, best: 3 });
});

test('a document from a newer build is left untouched and the app asks to be closed and reopened', async ({
  page,
}) => {
  const newer = '{"version":4,"learner":{"tables":[6]}}';
  const backup = '{"version":3,"tables":"old"}';
  await page.addInitScript(
    ({ entries }: { entries: [string, string][] }) => {
      for (const [key, value] of entries) localStorage.setItem(key, value);
    },
    {
      entries: [
        [PROGRESS_KEY, newer],
        [BACKUP_KEY, backup],
      ] as [string, string][],
    },
  );
  await page.goto('./');

  await expect(
    page.getByRole('heading', { level: 1, name: 'This app needs an update' }),
  ).toBeVisible();
  await expect(
    page.getByText('Close the app and open it again.'),
  ).toBeVisible();
  await expect(startHeading(page)).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(0);

  expect(
    await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY),
  ).toBe(newer);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBe(backup);
});
