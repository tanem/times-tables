import type { Page, Locator } from '@playwright/test';
import { freshProgress } from '../src/model/progress';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  balance,
  buyButton,
  character,
  openShop,
  pick,
  practiseButton,
  said,
  seedProgress,
  shopper,
  startHeading,
  storedProgress,
} from './helpers';

// The Shop's colour variants.
function colourShelf(page: Page): Locator {
  return page.getByRole('group', { name: 'Colours' });
}

// A colour variant in the Shop by its name alone, whatever its price or mark.
function item(page: Page, name: string): Locator {
  return colourShelf(page).getByRole('button', {
    name: new RegExp(`^${name},`),
  });
}

// The chosen character's row of colours on the Start screen.
function colourRow(page: Page): Locator {
  return page.getByRole('group', { name: 'Your colour' });
}

// One colour in that row by its name, or "Own colour".
function colourPick(page: Page, name: string): Locator {
  return colourRow(page).getByRole('button', { name, exact: true });
}

test('a colour variant bought in the Shop is chosen on the Start screen and shows in a drill', async ({
  page,
}) => {
  await seedProgress(page, shopper(100));
  await expect(colourRow(page)).toHaveCount(0);

  await openShop(page);
  await expect(colourShelf(page).getByRole('button')).toHaveCount(4);
  await item(page, 'Blue dragon').click();
  await expect(item(page, 'Blue dragon')).toHaveAccessibleName(
    'Blue dragon, 25 gems',
  );
  await expect(character(page, 'blue dragon')).toBeVisible();

  await buyButton(page).click();
  await expect(balance(page)).toHaveText('75 gems');
  await expect(item(page, 'Blue dragon')).toHaveAccessibleName(
    'Blue dragon, owned',
  );
  expect(await storedProgress(page)).toMatchObject({
    earned: 100,
    balance: 75,
    owned: ['dragon-blue'],
    colours: { dragon: null },
  });

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(startHeading(page)).toBeVisible();
  await expect(colourRow(page).getByRole('button')).toHaveCount(2);
  await expect(colourPick(page, 'Own colour')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(character(page, 'dragon')).toBeVisible();

  await colourPick(page, 'Blue dragon').click();
  await expect(colourPick(page, 'Blue dragon')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(character(page, 'blue dragon')).toBeVisible();
  expect((await storedProgress(page)).colours.dragon).toBe('dragon-blue');

  await practiseButton(page).click();
  await answerCard(page, 'fast');
  await expect(character(page, 'blue dragon', 'jumps')).toBeVisible();
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(character(page, 'blue dragon', 'waves')).toBeVisible();

  await page.getByRole('button', { name: 'Home' }).click();
  await colourPick(page, 'Own colour').click();
  await expect(character(page, 'dragon')).toBeVisible();
  expect((await storedProgress(page)).colours.dragon).toBeNull();
});

test('each character keeps its own colour and is offered only its own variants', async ({
  page,
}) => {
  await seedProgress(
    page,
    shopper(0, {
      owned: ['dragon-purple', 'cat-black'],
      colours: { ...freshProgress().colours, dragon: 'dragon-purple' },
    }),
  );
  await expect(character(page, 'purple dragon')).toBeVisible();
  await expect(colourRow(page).getByRole('button')).toHaveCount(2);
  await expect(colourPick(page, 'Purple dragon')).toBeVisible();
  await expect(colourPick(page, 'Black cat')).toHaveCount(0);

  await pick(page, 'Cat').click();
  await expect(character(page, 'cat')).toBeVisible();
  await expect(colourPick(page, 'Own colour')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(colourPick(page, 'Purple dragon')).toHaveCount(0);
  await colourPick(page, 'Black cat').click();
  await expect(character(page, 'black cat')).toBeVisible();
  expect((await storedProgress(page)).colours).toMatchObject({
    dragon: 'dragon-purple',
    cat: 'cat-black',
  });

  await pick(page, 'Dragon').click();
  await expect(character(page, 'purple dragon')).toBeVisible();

  await page.reload();
  await expect(character(page, 'purple dragon')).toBeVisible();
  await pick(page, 'Cat').click();
  await expect(character(page, 'black cat')).toBeVisible();
});

test('the Shop shows a variant on its own character, whichever is chosen', async ({
  page,
}) => {
  await seedProgress(page, shopper(0));
  await openShop(page);
  await expect(character(page, 'dragon')).toBeVisible();
  await item(page, 'Grey cat').click();
  await expect(character(page, 'grey cat')).toBeVisible();
  await expect(buyButton(page)).toBeDisabled();
  await expect(said(page)).toHaveText('25 gems more to go');
});
