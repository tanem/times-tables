import { pool } from '../src/model/facts';
import { freshProgress } from '../src/model/progress';
import { PROGRESS_KEY, BACKUP_KEY } from '../src/storage';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  balance,
  character,
  DIALOG_AT,
  expectNoTableOn,
  factOnScreen,
  openParent,
  pick,
  startHeading,
  storedProgress,
  practiseButton,
  tile,
  unlockDialog,
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

test('a version 1 document is backed up, the app starts fresh and a drill saves a version 4 document', async ({
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
  expect(stored.version).toBe(4);
  // The one fast answer took its fact to level 1 for the first time.
  expect(stored).toMatchObject({ earned: 1, balance: 1 });
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

// A document the version 2 build accepts: the 6s on, a fact at level 2,
// answer times and a drill record.
const VERSION_2 = JSON.stringify({
  version: 2,
  tables: [6],
  facts: { '6x7': { level: 2, fast: 2, slow: 0, missed: 0 } },
  times: [2600, 2200],
  records: [],
});

test('a version 2 document is backed up and the app starts fresh', async ({
  page,
}) => {
  await page.addInitScript(([key, text]) => localStorage.setItem(key, text), [
    PROGRESS_KEY,
    VERSION_2,
  ] as const);
  await page.goto('./');

  await expectNoTableOn(page);
  await expect(balance(page)).toHaveText('0 gems');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBe(VERSION_2);
});

// A document the version 3 build accepts: the 6s on, every fact of the 6s
// at level 2, one fact known from outside them, answer times, a drill
// record, the owl chosen and 150 gems, which have unlocked the cat, the
// robot and the owl.
const VERSION_3_RECORD = {
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

function version3Facts(): Record<string, object> {
  const facts: Record<string, object> = {
    '3x5': { level: 4, best: 4, fast: 6, slow: 0, missed: 0 },
  };
  for (let n = 1; n <= 12; n++) {
    facts[`${Math.min(6, n)}x${Math.max(6, n)}`] = {
      level: 2,
      best: 3,
      fast: 3,
      slow: 0,
      missed: 1,
    };
  }
  return facts;
}

const VERSION_3 = JSON.stringify({
  version: 3,
  tables: [6],
  facts: version3Facts(),
  gems: 150,
  character: 'owl',
  times: [2600, 2200],
  records: [VERSION_3_RECORD],
});

test('a version 3 document is migrated with its gems as both earned and the balance, and its characters stay unlocked with no dialog', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(([key, text]) => localStorage.setItem(key, text), [
    PROGRESS_KEY,
    VERSION_3,
  ] as const);
  await page.goto('./');

  // The migrated document is written back at launch, with no backup.
  await expect(tile(page, '6s')).toHaveAttribute('aria-pressed', 'true');
  const migrated = await storedProgress(page);
  expect(migrated).toEqual({
    ...freshProgress(),
    tables: [6],
    facts: version3Facts(),
    earned: 150,
    balance: 150,
    character: 'owl',
    times: [2600, 2200],
    records: [VERSION_3_RECORD],
  });
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBeNull();

  // The balance shows in the corner, and the characters the gems unlocked
  // stay unlocked, the owl still chosen.
  await expect(balance(page)).toHaveText('150 gems');
  for (const name of ['Dragon', 'Cat', 'Robot', 'Owl']) {
    await expect(pick(page, name)).toHaveAccessibleName(name);
  }
  await expect(pick(page, 'Owl')).toHaveAttribute('aria-pressed', 'true');
  await expect(pick(page, 'Unicorn')).toHaveAccessibleName(
    'Unicorn, locked, 170 gems',
  );

  await openParent(page);
  await expect(page.getByText('Gems: 150 earned, 150 to spend')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  // A fast answer takes a fact of the 6s back to level 3, which it reached
  // before, so it pays nothing: the migration kept every highest level.
  await practiseButton(page).click();
  const { x, y } = await factOnScreen(page);
  const factKey = `${Math.min(x, y)}x${Math.max(x, y)}`;
  await answerCard(page, 'fast');
  expect(await storedProgress(page)).toMatchObject({
    earned: 150,
    balance: 150,
  });
  expect((await storedProgress(page)).facts[factKey]).toMatchObject({
    level: 3,
    best: 3,
  });

  // Quitting pays no band pay, and nothing unlocked is announced.
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await page.clock.runFor(DIALOG_AT);
  await expect(unlockDialog(page)).toHaveCount(0);
  expect(await storedProgress(page)).toMatchObject({
    earned: 150,
    balance: 150,
  });
});

// A version 3 document whose 3s are complete: every fact at level 4, and
// the gems they paid.
function version3Complete(): string {
  const facts: Record<string, object> = {};
  for (const fact of pool([3])) {
    facts[fact.key] = { level: 4, best: 4, fast: 4, slow: 0, missed: 0 };
  }
  return JSON.stringify({
    version: 3,
    tables: [3],
    facts,
    gems: 48,
    character: 'dragon',
    times: [],
    records: [],
  });
}

test('a version 3 document whose levels complete a table shows its badge, and no drill pays for it', async ({
  page,
}) => {
  await page.goto('./');
  await page.evaluate(([key, text]) => localStorage.setItem(key, text), [
    PROGRESS_KEY,
    version3Complete(),
  ] as const);
  await page.goto('./');

  await expect(tile(page, '3s, badge')).toBeVisible();
  await expect(balance(page)).toHaveText('48 gems');

  // Every fact of the 3s has paid all its gems, and the quit drill pays no
  // band pay, so a badge paid would be all that moved the gems.
  await practiseButton(page).click();
  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.locator('.end .pay')).toHaveCount(0);
  expect(await storedProgress(page)).toMatchObject({
    earned: 48,
    balance: 48,
  });
});

test('a document from a newer build is left untouched and the app asks to be closed and reopened', async ({
  page,
}) => {
  const newer = '{"version":5,"learner":{"tables":[6]}}';
  const backup = '{"version":4,"tables":"old"}';
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
  // The dragon sits with it, whatever character the newer document names.
  await expect(character(page, 'dragon')).toBeVisible();

  expect(
    await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY),
  ).toBe(newer);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
  ).toBe(backup);
});
