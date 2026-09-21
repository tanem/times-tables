import type { Page } from '@playwright/test';
import {
  freshProgress,
  type DrillRecord,
  type Progress,
} from '../src/model/progress';
import { BACKUP_KEY, PROGRESS_KEY } from '../src/storage';
import { expect, test } from './fixtures';
import {
  expectNoTableOn,
  openParent,
  progressHeading,
  startHeading,
  storedProgress,
} from './helpers';

const OLD_DRILL: DrillRecord = {
  at: '2026-01-01T08:00:00.000Z',
  tables: [6],
  fast: 16,
  slow: 3,
  missed: 1,
  quit: false,
  pace: 2400,
  known: 0,
  median: 2200,
};

// A stored document visibly not fresh: one table, a levelled fact, answer
// times and a drill record, so an erase has something real to remove.
const NOT_FRESH: Progress = {
  version: 3,
  tables: [6],
  facts: { '6x7': { level: 3, best: 4, fast: 5, slow: 1, missed: 1 } },
  gems: 26,
  character: 'cat',
  times: [2600, 2200],
  records: [OLD_DRILL],
};

// Seeds the progress document and a backup key, as an earlier corrupt
// document would leave behind, then opens the app on the Parent view. Uses
// addInitScript, which re-seeds on every navigation, so a test that reloads
// seeds a different way instead.
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

// The backup key alone; the progress document is read with storedProgress.
async function storedBackup(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY);
}

test('holding the erase control for three seconds erases progress and returns to the Start screen', async ({
  page,
}) => {
  let dialogShown = false;
  page.on('dialog', (dialog) => {
    dialogShown = true;
    void dialog.dismiss();
  });

  await openNotFreshOnParent(page);

  await eraseButton(page).hover();
  await page.mouse.down();
  // The control takes about three seconds to fill, and the test clock
  // moves in whole frames, so this runs a little past that mark.
  await page.clock.runFor(3100);

  await expect(startHeading(page)).toBeVisible();
  await expectNoTableOn(page);
  expect(await storedProgress(page)).toEqual(freshProgress());
  expect(await storedBackup(page)).toBeNull();
  expect(dialogShown).toBe(false);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('releasing before three seconds cancels with no dialog or message, and a later hold does not pick up where it left off', async ({
  page,
}) => {
  let dialogShown = false;
  page.on('dialog', (dialog) => {
    dialogShown = true;
    void dialog.dismiss();
  });

  await openNotFreshOnParent(page);
  const button = eraseButton(page);

  await button.hover();
  await page.mouse.down();
  await page.clock.runFor(2000);
  await page.mouse.up();
  await page.clock.runFor(2000); // well past three seconds, but released

  await expect(progressHeading(page)).toBeVisible();
  expect(await storedProgress(page)).toEqual(NOT_FRESH);
  expect(await storedBackup(page)).not.toBeNull();
  await expect(page.getByRole('status')).toHaveText('');
  expect(dialogShown).toBe(false);

  // Holds do not accumulate: a fresh hold starts back at zero.
  await button.hover();
  await page.mouse.down();
  await page.clock.runFor(2000);
  await expect(progressHeading(page)).toBeVisible();

  await page.clock.runFor(1100); // carries the same hold on to three seconds
  await expect(startHeading(page)).toBeVisible();
});

test('holding just short of three seconds does nothing', async ({ page }) => {
  await openNotFreshOnParent(page);

  await eraseButton(page).hover();
  await page.mouse.down();
  await page.clock.runFor(2900);
  await page.mouse.up();

  await expect(progressHeading(page)).toBeVisible();
  expect(await storedProgress(page)).toEqual(NOT_FRESH);
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
  expect(await storedProgress(page)).toEqual(NOT_FRESH);
});

// fastForward jumps the clock without running the frames in between, the
// way the device sleeping or the app going to the background would stall
// them, with no pointerup or pointercancel ever arriving.
test('a hold stalled well past three seconds without a release does not erase', async ({
  page,
}) => {
  await openNotFreshOnParent(page);

  await eraseButton(page).hover();
  await page.mouse.down();
  await page.clock.runFor(1000);
  await page.clock.fastForward(5000);
  await page.clock.runFor(100);

  await expect(progressHeading(page)).toBeVisible();
  expect(await storedProgress(page)).toEqual(NOT_FRESH);

  await page.mouse.up();
});

test('an erase survives a reload', async ({ page }) => {
  await page.goto('./');
  // A plain write, not addInitScript, so the second reload below does not
  // seed the document straight back.
  await page.evaluate(
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
  await page.reload();
  await openParent(page);

  await eraseButton(page).hover();
  await page.mouse.down();
  await page.clock.runFor(3100);

  await page.reload();

  await expect(startHeading(page)).toBeVisible();
  await expectNoTableOn(page);
  expect(await storedBackup(page)).toBeNull();
});

// These tests send touch input from outside the app over CDP, which only
// Chromium has, so they run on Chromium only.
test.describe('touch', () => {
  test.use({ hasTouch: true });

  // The centre of the control in the viewport, scrolled to first: the touch
  // is sent to a point, and the control sits at the foot of a long page.
  async function eraseCentre(page: Page): Promise<{ x: number; y: number }> {
    await eraseButton(page).scrollIntoViewIfNeeded();
    const box = await eraseButton(page).boundingBox();
    if (!box) throw new Error('the erase control is not laid out');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  test('a touch held on the control for the full hold erases', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'touch input over CDP needs Chromium',
    );
    await openNotFreshOnParent(page);
    const { x, y } = await eraseCentre(page);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    await page.clock.runFor(3100);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await expect(startHeading(page)).toBeVisible();
    expect(await storedProgress(page)).toEqual(freshProgress());
  });

  test('a touch that slides off the control and stays down past three seconds does not erase', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'touch input over CDP needs Chromium',
    );
    await openNotFreshOnParent(page);
    const { x, y } = await eraseCentre(page);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 0, y: 0 }],
    });
    await page.clock.runFor(3100);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });

    await expect(progressHeading(page)).toBeVisible();
    expect(await storedProgress(page)).toEqual(NOT_FRESH);
  });
});

test('holding Space on the focused control for three seconds erases', async ({
  page,
}) => {
  await openNotFreshOnParent(page);

  await eraseButton(page).focus();
  await page.keyboard.down('Space');
  await page.clock.runFor(3100);

  await expect(startHeading(page)).toBeVisible();
  await expectNoTableOn(page);
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
  expect(await storedProgress(page)).toEqual(NOT_FRESH);
});
