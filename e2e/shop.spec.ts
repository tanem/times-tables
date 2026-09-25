import type { Page, Locator } from '@playwright/test';
import { SET, type HatId } from '../src/model/catalogue';
import { freshProgress, type Progress } from '../src/model/progress';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  balance,
  character,
  confetti,
  pick,
  practiseButton,
  SEEDED_TABLES,
  seedProgress,
  startHeading,
  storedProgress,
} from './helpers';

// A learner with the seeded tables on, 100 gems earned, which unlocks the
// dragon and the cat, and the given balance. What they own and wear can be
// set too.
function learner(
  balance: number,
  items: Partial<Pick<Progress, 'owned' | 'hat'>> = {},
): Progress {
  return {
    ...freshProgress(),
    tables: [...SEEDED_TABLES],
    earned: 100,
    balance,
    ...items,
  };
}

// The Shop's own heading.
function shopHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Shop' });
}

// Taps Shop on the Start screen and lands on the Shop.
async function openShop(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(shopHeading(page)).toBeVisible();
}

// An item in the Shop by its name alone, whatever its price or mark.
function item(page: Page, name: string): Locator {
  return page
    .getByRole('group', { name: 'Hats' })
    .getByRole('button', { name: new RegExp(`^${name},`) });
}

// The Buy button on the line for the chosen item.
function buyButton(page: Page): Locator {
  return page.getByRole('button', { name: /^Buy for/ });
}

// The line under the shelves that says what the chosen item is.
function said(page: Page): Locator {
  return page.locator('.buy-said');
}

// The row of owned hats on the Start screen.
function hatRow(page: Page): Locator {
  return page.getByRole('group', { name: 'Your hat' });
}

// One hat in that row by its name, or "No hat".
function hatPick(page: Page, name: string): Locator {
  return hatRow(page).getByRole('button', { name, exact: true });
}

test('a hat bought in the Shop is chosen on the Start screen and worn in a drill', async ({
  page,
}) => {
  await seedProgress(page, learner(100));
  await expect(hatRow(page)).toHaveCount(0);

  await openShop(page);
  await expect(balance(page)).toHaveText('100 gems');
  await item(page, 'Top hat').click();
  await expect(item(page, 'Top hat')).toHaveAccessibleName('Top hat, 40 gems');
  await expect(item(page, 'Top hat')).toHaveAttribute('aria-pressed', 'true');
  await expect(character(page, 'dragon', 'in a top hat')).toBeVisible();

  // Choosing an item tries it on and buys nothing: only Buy does.
  expect(await storedProgress(page)).toMatchObject({ balance: 100, owned: [] });
  await buyButton(page).click();
  await expect(balance(page)).toHaveText('60 gems');
  await expect(item(page, 'Top hat')).toHaveAccessibleName('Top hat, owned');
  await expect(buyButton(page)).toBeHidden();
  await expect(said(page)).toHaveText('You own the top hat');
  expect(await storedProgress(page)).toMatchObject({
    earned: 100,
    balance: 60,
    owned: ['top-hat'],
    hat: null,
  });

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(startHeading(page)).toBeVisible();
  await expect(balance(page)).toHaveText('60 gems');
  await expect(hatRow(page).getByRole('button')).toHaveCount(2);
  await expect(hatPick(page, 'No hat')).toHaveAttribute('aria-pressed', 'true');
  await expect(character(page, 'dragon')).toBeVisible();

  await hatPick(page, 'Top hat').click();
  await expect(hatPick(page, 'Top hat')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(character(page, 'dragon', 'in a top hat')).toBeVisible();
  expect((await storedProgress(page)).hat).toBe('top-hat');

  await practiseButton(page).click();
  await answerCard(page, 'fast');
  await expect(character(page, 'dragon', 'in a top hat jumps')).toBeVisible();
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(character(page, 'dragon', 'in a top hat waves')).toBeVisible();

  await page.getByRole('button', { name: 'Home' }).click();
  await hatPick(page, 'No hat').click();
  await expect(character(page, 'dragon')).toBeVisible();
  expect((await storedProgress(page)).hat).toBeNull();
});

test('every unlocked character wears the chosen hat', async ({ page }) => {
  await seedProgress(page, learner(0, { owned: ['wizard-hat'], hat: null }));
  await hatPick(page, 'Wizard hat').click();
  await pick(page, 'Cat').click();
  await expect(character(page, 'cat', 'in a wizard hat')).toBeVisible();

  await page.reload();
  await expect(character(page, 'cat', 'in a wizard hat')).toBeVisible();
  await expect(hatPick(page, 'Wizard hat')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('the Shop sells every hat whatever is unlocked, and Buy waits for the balance', async ({
  page,
}) => {
  await seedProgress(page, learner(25));
  await openShop(page);
  await expect(
    page.getByRole('group', { name: 'Hats' }).getByRole('button'),
  ).toHaveCount(SET.length + 1);

  await item(page, 'Party hat').click();
  await expect(buyButton(page)).toBeDisabled();
  await expect(buyButton(page)).toHaveAccessibleName('Buy for 40 gems');
  await expect(said(page)).toHaveText('15 gems more to go');
  await buyButton(page).click({ force: true });
  expect(await storedProgress(page)).toMatchObject({ balance: 25, owned: [] });
});

test('the crown cannot be bought', async ({ page }) => {
  await seedProgress(page, learner(100));
  await openShop(page);
  await item(page, 'Crown').click();
  await expect(item(page, 'Crown')).toHaveAccessibleName(
    'Crown, earned by every hat',
  );
  await expect(buyButton(page)).toBeHidden();
  await expect(said(page)).toHaveText('Own all 6 hats to earn the crown');
});

test('buying the sixth hat completes the set, earns the crown and celebrates', async ({
  page,
}) => {
  const five: HatId[] = SET.slice(0, 5);
  await seedProgress(page, learner(40, { owned: five, hat: 'party-hat' }));
  await openShop(page);
  await item(page, 'Bobble hat').click();
  await buyButton(page).click();

  await expect(said(page)).toHaveText(
    'You have every hat. The crown is yours!',
  );
  await expect(confetti(page)).toBeVisible();
  await expect(
    character(page, 'dragon', 'in a crown jumps high'),
  ).toBeVisible();
  await expect(item(page, 'Crown')).toHaveAccessibleName('Crown, owned');
  await expect(balance(page)).toHaveText('0 gems');
  expect(await storedProgress(page)).toMatchObject({
    balance: 0,
    owned: [...SET, 'crown'],
  });

  await page.getByRole('button', { name: 'Back' }).click();
  await hatPick(page, 'Crown').click();
  await expect(character(page, 'dragon', 'in a crown')).toBeVisible();
});
