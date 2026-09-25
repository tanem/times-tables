import type { Locator, Page } from '@playwright/test';
import { CHARACTERS } from '../src/model/characters';
import { expect, test } from './fixtures';
import {
  advance,
  animates,
  answerCard,
  balance,
  buyButton,
  character,
  openShop,
  practiseButton,
  said,
  seedProgress,
  shopper,
  storedProgress,
} from './helpers';

// The Shop's poses.
function poseShelf(page: Page): Locator {
  return page.getByRole('group', { name: 'Poses' });
}

// The backflip in the Shop, whatever its price or mark.
function backflipItem(page: Page): Locator {
  return poseShelf(page).getByRole('button', { name: /^Backflip,/ });
}

test('the backflip is sold once in the Shop, and tapping it has the character try it', async ({
  page,
}) => {
  await seedProgress(
    page,
    shopper(100, { owned: ['top-hat'], hat: 'top-hat' }),
  );
  await openShop(page);
  await expect(poseShelf(page).getByRole('button')).toHaveCount(1);
  await expect(backflipItem(page)).toHaveAccessibleName('Backflip, 100 gems');

  await backflipItem(page).click();
  await expect(
    character(page, 'dragon', 'in a top hat does a backflip'),
  ).toBeVisible();
  await expect(said(page)).toHaveText('Backflip');

  await buyButton(page).click();
  await expect(balance(page)).toHaveText('0 gems');
  await expect(backflipItem(page)).toHaveAccessibleName('Backflip, owned');
  await expect(buyButton(page)).toBeHidden();
  await expect(said(page)).toHaveText('You own the backflip');
  expect(await storedProgress(page)).toMatchObject({
    earned: 100,
    balance: 0,
    owned: ['top-hat', 'backflip'],
  });

  // Owned, it cannot be bought again.
  await backflipItem(page).click();
  await expect(buyButton(page)).toBeHidden();
});

test('a fast answer plays the backflip once it is owned, and the jump before', async ({
  page,
}) => {
  await seedProgress(page, shopper(100));
  await practiseButton(page).click();
  await answerCard(page, 'fast');
  await expect(character(page, 'dragon', 'jumps')).toBeVisible();
  await expect(character(page, 'dragon', 'does a backflip')).toHaveCount(0);

  await seedProgress(page, shopper(0, { owned: ['backflip'] }));
  await practiseButton(page).click();
  for (let index = 0; index < 3; index++) {
    await answerCard(page, 'fast');
    const flipping = character(page, 'dragon', 'does a backflip');
    await expect(flipping).toBeVisible();
    expect(
      await flipping.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('backflip');
    await advance(page);
  }

  // A missed answer still shrugs.
  await answerCard(page, 'missed');
  await expect(character(page, 'dragon', 'shrugs')).toBeVisible();
});

test('every character plays the backflip, with its hat on its head', async ({
  page,
}) => {
  for (const name of CHARACTERS) {
    await seedProgress(page, {
      ...shopper(0, { owned: ['party-hat', 'backflip'], hat: 'party-hat' }),
      earned: 240,
      character: name,
    });
    await practiseButton(page).click();
    await answerCard(page, 'fast');
    const flipping = character(page, name, 'in a party hat does a backflip');
    await expect(flipping).toBeVisible();
    expect(await flipping.evaluate(animates)).toBe(true);
    await expect(flipping.locator('.head .hat')).toHaveCount(1);
  }
});
