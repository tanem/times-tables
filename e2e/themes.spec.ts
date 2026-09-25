import type { Locator, Page } from '@playwright/test';
import { PALETTES } from '../src/screens/theme';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  balance,
  buyButton,
  openParent,
  openShop,
  practiseButton,
  said,
  seedProgress,
  shopper,
  startHeading,
  storedProgress,
} from './helpers';

// A palette's page colour as the browser reports a computed colour.
function paperOf(theme: keyof typeof PALETTES): string {
  const hex = PALETTES[theme].colours.paper;
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

// The colour the page is painted in behind the screen on show.
async function pageColour(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

// The Shop's themes.
function themeShelf(page: Page): Locator {
  return page.getByRole('group', { name: 'Themes' });
}

// A theme in the Shop by its name alone, whatever its price or mark.
function item(page: Page, name: string): Locator {
  return themeShelf(page).getByRole('button', {
    name: new RegExp(`^${name},`),
  });
}

// The row of themes on the Start screen.
function themeRow(page: Page): Locator {
  return page.getByRole('group', { name: 'Your theme' });
}

// One theme in that row by its name, or "Default".
function themePick(page: Page, name: string): Locator {
  return themeRow(page).getByRole('button', { name, exact: true });
}

test('a theme bought in the Shop is chosen on the Start screen and colours a drill', async ({
  page,
}) => {
  await seedProgress(page, shopper(100));
  await expect(themeRow(page)).toHaveCount(0);
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    paperOf('default'),
  );

  await openShop(page);
  await expect(themeShelf(page).getByRole('button')).toHaveCount(2);
  await item(page, 'Ocean').click();
  await expect(item(page, 'Ocean')).toHaveAccessibleName('Ocean, 60 gems');
  await expect(page.locator('.shop')).toHaveCSS(
    'background-color',
    paperOf('ocean'),
  );

  await buyButton(page).click();
  await expect(balance(page)).toHaveText('40 gems');
  await expect(item(page, 'Ocean')).toHaveAccessibleName('Ocean, owned');
  await expect(said(page)).toHaveText('You own the ocean theme');
  expect(await storedProgress(page)).toMatchObject({
    balance: 40,
    owned: ['ocean'],
    theme: null,
  });

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(startHeading(page)).toBeVisible();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    paperOf('default'),
  );
  await expect(themeRow(page).getByRole('button')).toHaveCount(2);
  await expect(themePick(page, 'Default')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await themePick(page, 'Ocean').click();
  await expect(themePick(page, 'Ocean')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    paperOf('ocean'),
  );
  expect((await storedProgress(page)).theme).toBe('ocean');

  await practiseButton(page).click();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    paperOf('ocean'),
  );
  await answerCard(page, 'fast');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    paperOf('ocean'),
  );
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    paperOf('ocean'),
  );

  await page.reload();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    paperOf('ocean'),
  );
  await themePick(page, 'Default').click();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    paperOf('default'),
  );
  expect((await storedProgress(page)).theme).toBeNull();
});

test('a theme tried on in the Shop is not kept', async ({ page }) => {
  await seedProgress(page, shopper(0, { owned: ['ocean'], theme: 'ocean' }));
  await openShop(page);
  await expect(page.locator('.shop')).toHaveCSS(
    'background-color',
    paperOf('ocean'),
  );
  await item(page, 'Space').click();
  await expect(said(page)).toHaveText('60 gems more to go');
  await expect(page.locator('.shop')).toHaveCSS(
    'background-color',
    paperOf('space'),
  );

  await page.getByRole('button', { name: /^Top hat,/ }).click();
  await expect(page.locator('.shop')).toHaveCSS(
    'background-color',
    paperOf('ocean'),
  );

  await item(page, 'Space').click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    paperOf('ocean'),
  );
  expect((await storedProgress(page)).theme).toBe('ocean');
});

// The Parent view as a picture, which no theme may change.
async function parentPicture(page: Page): Promise<Buffer> {
  await openParent(page);
  const picture = await page.screenshot({
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(startHeading(page)).toBeVisible();
  return picture;
}

test('the Parent view keeps its own colours under every theme', async ({
  page,
}) => {
  await seedProgress(page, shopper(0, { owned: ['ocean', 'space'] }));
  const plain = await parentPicture(page);

  for (const name of ['Ocean', 'Space']) {
    await themePick(page, name).click();
    const themed = await pageColour(page);
    expect(themed).not.toBe(paperOf('default'));
    expect((await parentPicture(page)).equals(plain)).toBe(true);
    await expect(page.locator('body')).toHaveCSS('background-color', themed);
  }
});

test("the device's light or dark setting leaves every theme's colours as they are", async ({
  page,
}) => {
  await seedProgress(page, shopper(0, { owned: ['space'], theme: 'space' }));
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      paperOf('space'),
    );
    await themePick(page, 'Default').click();
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      paperOf('default'),
    );
    await themePick(page, 'Space').click();
  }
});
