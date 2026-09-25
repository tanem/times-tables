import { pool } from '../src/model/facts';
import { freshProgress, type Progress } from '../src/model/progress';
import { expect, test } from './fixtures';
import {
  answerAllFast,
  badgePay,
  balance,
  bandPay,
  openParent,
  practiseButton,
  seedProgress,
  storedProgress,
  tile,
} from './helpers';

// The 7s with every fact at level 4 but 7 × 8, which is at level 3 and has
// never been higher, so the first fast answer on it completes the table.
// Earned covers what the facts paid, and sits short of the owl, so that no
// character unlocks.
function sevensShortOfBadge(): Progress {
  const facts: Progress['facts'] = {};
  for (const fact of pool([7])) {
    facts[fact.key] = { level: 4, best: 4, fast: 4, slow: 0, missed: 0 };
  }
  facts['7x8'] = { level: 3, best: 3, fast: 3, slow: 0, missed: 0 };
  return { ...freshProgress(), tables: [7], facts, earned: 70, balance: 70 };
}

// The 7s with every fact at a highest level of 4 and 7 × 8 since dropped to
// level 0.
function sevensDropped(): Progress {
  const progress = sevensShortOfBadge();
  progress.facts['7x8'] = { level: 0, best: 4, fast: 4, slow: 0, missed: 1 };
  return { ...progress, earned: 71, balance: 71 };
}

test('a drill that completes a table earns its badge, pays 10 for it and marks its tile and grid row', async ({
  page,
}) => {
  await seedProgress(page, sevensShortOfBadge());
  await expect(tile(page, '7s')).toBeVisible();
  await expect(page.locator('.tile .badge')).toHaveCount(0);

  await practiseButton(page).click();
  await answerAllFast(page);

  // 7 × 8 was drawn and answered fast, taking it to level 4 for the first
  // time: 1 gem for the level, 3 for the top band and 10 for the badge.
  const stored = await storedProgress(page);
  expect(stored.facts['7x8']).toMatchObject({ level: 4, best: 4 });
  expect(stored).toMatchObject({ earned: 84, balance: 84 });
  await expect(bandPay(page)).toHaveText('+3 gems for this drill');
  await expect(badgePay(page)).toHaveText(['+10 gems for the 7s badge']);

  await page.getByRole('button', { name: 'Home' }).click();
  await expect(tile(page, '7s, badge')).toBeVisible();
  await expect(tile(page, '7s, badge').locator('.badge')).toBeVisible();
  await expect(tile(page, '6s')).toBeVisible();
  await expect(balance(page)).toHaveText('84 gems');

  await openParent(page);
  await expect(page.getByRole('group', { name: '7s, badge' })).toBeVisible();
  await expect(
    page.getByRole('group', { name: '6s', exact: true }),
  ).toBeVisible();
});

test('a badge stays on the tile and the grid after a fact in its table drops', async ({
  page,
}) => {
  await seedProgress(page, sevensDropped());
  await expect(tile(page, '7s, badge')).toBeVisible();

  await openParent(page);
  await expect(page.getByRole('group', { name: '7s, badge' })).toBeVisible();
});

test('a drill after the badge was earned pays nothing more for it', async ({
  page,
}) => {
  await seedProgress(page, sevensDropped());
  await practiseButton(page).click();
  await answerAllFast(page);

  await expect(badgePay(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(tile(page, '7s, badge')).toBeVisible();
});
