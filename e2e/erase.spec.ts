import type { Page } from '@playwright/test';
import type { DrillRecord, Progress } from '../src/model/progress';
import { BACKUP_KEY, PROGRESS_KEY } from '../src/storage';
import { expect, test } from './fixtures';
import { openParent, progressHeading } from './helpers';

const TILES = ['6s', '8s', '12s'];

async function expectAllTablesOn(page: Page): Promise<void> {
  for (const table of TILES) {
    await expect(
      page.getByRole('button', { name: table, pressed: true }),
    ).toBeVisible();
  }
}

const OLD_RUN: DrillRecord = {
  mode: 'speed',
  at: '2026-01-01T08:00:00.000Z',
  tables: [6, 8, 12],
  fast: 33,
  slow: 0,
  missed: 0,
  quit: false,
  time: 25000,
};

// A stored document visibly not fresh: one table, a levelled fact and a
// completed speed run, so an erase has something real to remove.
const NOT_FRESH: Progress = {
  version: 1,
  tables: [6],
  facts: { '6x7': { level: 3, fast: 5, slow: 1, missed: 1 } },
  records: [OLD_RUN],
};

// Seeds the progress document and a backup key, as an earlier corrupt
// document would leave behind, then opens the app on the Parent view.
async function openNotFreshOnParent(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, backupKey, text }) => {
      localStorage.setItem(key, text);
      localStorage.setItem(backupKey, '{"backed":"up"}');
    },
    {
      key: PROGRESS_KEY,
      backupKey: BACKUP_KEY,
      text: JSON.stringify(NOT_FRESH),
    },
  );
  await page.goto('./');
  await openParent(page);
}

function eraseButton(page: Page) {
  return page.getByRole('button', { name: 'Erase all progress' });
}

async function storedText(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

test('holding the erase control for three seconds erases progress and returns to the Start screen', async ({
  page,
}) => {
  await openNotFreshOnParent(page);

  await eraseButton(page).hover();
  await page.mouse.down();
  // A little past the three-second mark, so a frame actually lands there:
  // the ring only notices the threshold on the animation frame that hits
  // or passes it, same as a real hold would.
  await page.clock.runFor(3100);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Times tables' }),
  ).toBeVisible();
  await expectAllTablesOn(page);
  await expect(page.getByText('all 33 facts, no best yet')).toBeVisible();

  const stored = await storedText(page, PROGRESS_KEY);
  expect(stored && JSON.parse(stored)).toEqual({
    version: 1,
    tables: [6, 8, 12],
    facts: {},
    records: [],
  });
  expect(await storedText(page, BACKUP_KEY)).toBeNull();
});

test('releasing before three seconds cancels with no dialog or message, and a later hold does not pick up where it left off', async ({
  page,
}) => {
  let dialogShown = false;
  page.on('dialog', (dialog) => {
    dialogShown = true;
    dialog.dismiss();
  });

  await openNotFreshOnParent(page);
  const button = eraseButton(page);

  await button.hover();
  await page.mouse.down();
  await page.clock.runFor(2000);
  await page.mouse.up();
  await page.clock.runFor(2000); // well past three seconds, but released

  await expect(progressHeading(page)).toBeVisible();
  const stored = await storedText(page, PROGRESS_KEY);
  expect(stored && JSON.parse(stored)).toEqual(NOT_FRESH);
  expect(await storedText(page, BACKUP_KEY)).not.toBeNull();
  await expect(page.getByRole('status')).toHaveText('');
  expect(dialogShown).toBe(false);

  // Holds do not accumulate: a fresh hold starts back at zero.
  await button.hover();
  await page.mouse.down();
  await page.clock.runFor(2000);
  await expect(progressHeading(page)).toBeVisible();

  await page.clock.runFor(1100); // carries the same hold on to three seconds
  await expect(
    page.getByRole('heading', { level: 1, name: 'Times tables' }),
  ).toBeVisible();
});

test('holding just short of three seconds does nothing', async ({ page }) => {
  await openNotFreshOnParent(page);

  await eraseButton(page).hover();
  await page.mouse.down();
  await page.clock.runFor(2900);
  await page.mouse.up();

  await expect(progressHeading(page)).toBeVisible();
  const stored = await storedText(page, PROGRESS_KEY);
  expect(stored && JSON.parse(stored)).toEqual(NOT_FRESH);
});

test('the pointer leaving the control mid-hold cancels', async ({ page }) => {
  await openNotFreshOnParent(page);

  await eraseButton(page).hover();
  await page.mouse.down();
  await page.clock.runFor(1000);
  await page.mouse.move(0, 0);
  await page.clock.runFor(2500);
  await page.mouse.up();

  await expect(progressHeading(page)).toBeVisible();
  const stored = await storedText(page, PROGRESS_KEY);
  expect(stored && JSON.parse(stored)).toEqual(NOT_FRESH);
});

test('holding Space on the focused control for three seconds erases', async ({
  page,
}) => {
  await openNotFreshOnParent(page);

  await eraseButton(page).focus();
  await page.keyboard.down('Space');
  await page.clock.runFor(3100);

  await expect(
    page.getByRole('heading', { level: 1, name: 'Times tables' }),
  ).toBeVisible();
  await expectAllTablesOn(page);
  await expect(page.getByText('all 33 facts, no best yet')).toBeVisible();
});

test('releasing Space before three seconds cancels the keyboard hold', async ({
  page,
}) => {
  await openNotFreshOnParent(page);

  await eraseButton(page).focus();
  await page.keyboard.down('Space');
  await page.clock.runFor(1500);
  await page.keyboard.up('Space');
  await page.clock.runFor(2000);

  await expect(progressHeading(page)).toBeVisible();
  const stored = await storedText(page, PROGRESS_KEY);
  expect(stored && JSON.parse(stored)).toEqual(NOT_FRESH);
});
