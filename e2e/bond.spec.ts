import type { Page } from '@playwright/test';
import type { Character } from '../src/model/characters';
import { freshProgress, type Progress } from '../src/model/progress';
import { expect, test } from './fixtures';
import {
  advance,
  animates,
  answerAllFast,
  answerCard,
  bondMeter,
  character,
  dragon,
  pick,
  practiseButton,
  seedProgress,
  SEEDED_TABLES,
  storedProgress,
} from './helpers';

// A document with the seeded tables on, so that the Start screen does not
// nudge, the given bond with each character and every character unlocked.
function withBond(bond: Partial<Record<Character, number>>): Progress {
  return {
    ...freshProgress(),
    tables: [...SEEDED_TABLES],
    earned: 240,
    balance: 240,
    bond: { ...freshProgress().bond, ...bond },
  };
}

// The meter's reading: the drills it shows, and the stretch it spans.
async function expectMeter(
  page: Page,
  now: number,
  min: number,
  max: number,
): Promise<void> {
  const meter = bondMeter(page);
  await expect(meter).toHaveAttribute('aria-valuenow', String(now));
  await expect(meter).toHaveAttribute('aria-valuemin', String(min));
  await expect(meter).toHaveAttribute('aria-valuemax', String(max));
}

test('a finished drill moves the meter under the chosen character and a quit one does not', async ({
  page,
}) => {
  await seedProgress(page, withBond({ dragon: 3, cat: 7 }));
  await expectMeter(page, 3, 0, 10);
  await expect(bondMeter(page)).toHaveAccessibleName('Bond with the dragon');
  await expect(bondMeter(page)).toHaveAttribute(
    'aria-valuetext',
    '3 drills, next pose at 10',
  );

  await practiseButton(page).click();
  await answerAllFast(page);
  await page.getByRole('button', { name: 'Home' }).click();
  await expectMeter(page, 4, 0, 10);
  expect((await storedProgress(page)).bond).toMatchObject({
    dragon: 4,
    cat: 7,
  });

  await practiseButton(page).click();
  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await page.getByRole('button', { name: 'Home' }).click();
  await expectMeter(page, 4, 0, 10);
  expect((await storedProgress(page)).bond.dragon).toBe(4);
});

test('the meter follows the character chosen in the row', async ({ page }) => {
  await seedProgress(page, withBond({ dragon: 3, cat: 16 }));
  await expectMeter(page, 3, 0, 10);

  await pick(page, 'Cat').click();
  await expect(bondMeter(page)).toHaveAccessibleName('Bond with the cat');
  await expectMeter(page, 16, 10, 25);
});

test('the finished drill that reaches a threshold changes the Start screen pose', async ({
  page,
}) => {
  await seedProgress(page, withBond({ dragon: 9 }));
  await expect(character(page, 'dragon')).toBeVisible();

  await practiseButton(page).click();
  await answerAllFast(page);
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(character(page, 'dragon', 'wiggles')).toBeVisible();
  await expectMeter(page, 10, 10, 25);
});

// The animation each pose plays on the character's body before this
// release, which no bond pose may share.
const EARLIER_ANIMATIONS = [
  'bob',
  'jump',
  'big-jump',
  'hop',
  'sway',
  'beckon-sway',
  'proud',
];

// The animation the character on the masthead plays, by the pose it is
// named for.
async function animationOf(page: Page, doing: string): Promise<string> {
  return dragon(page, doing).evaluate(
    (el) => getComputedStyle(el).animationName,
  );
}

test('each threshold has its own pose, unlike the earlier ones, and the meter reads full at 50 and beyond', async ({
  page,
}) => {
  const fill = page.locator('.bond-meter span');
  const width = () => fill.evaluate((el) => (el as HTMLElement).style.width);

  await seedProgress(page, withBond({ dragon: 24 }));
  await expect(character(page, 'dragon', 'wiggles')).toBeVisible();
  const wiggle = await animationOf(page, 'wiggles');

  await seedProgress(page, withBond({ dragon: 25 }));
  await expect(character(page, 'dragon', 'twirls')).toBeVisible();
  const twirl = await animationOf(page, 'twirls');
  await expectMeter(page, 25, 25, 50);
  expect(await width()).toBe('0%');

  await seedProgress(page, withBond({ dragon: 50 }));
  await expect(character(page, 'dragon', 'flips')).toBeVisible();
  const flip = await animationOf(page, 'flips');
  const poses = [wiggle, twirl, flip];
  expect(new Set(poses).size).toBe(3);
  for (const pose of poses) expect(EARLIER_ANIMATIONS).not.toContain(pose);
  await expectMeter(page, 50, 25, 50);
  await expect(bondMeter(page)).toHaveAttribute(
    'aria-valuetext',
    '50 drills, every pose open',
  );
  expect(await width()).toBe('100%');

  await seedProgress(page, withBond({ dragon: 80 }));
  await expect(character(page, 'dragon', 'flips')).toBeVisible();
  await expectMeter(page, 50, 25, 50);
  await expect(bondMeter(page)).toHaveAttribute(
    'aria-valuetext',
    '80 drills, every pose open',
  );
  expect(await width()).toBe('100%');
});

test('the wave to tap a table still comes before a bond pose', async ({
  page,
}) => {
  await seedProgress(page, { ...withBond({ dragon: 50 }), tables: [] });
  await expect(character(page, 'dragon', 'waves')).toBeVisible();
});

test('reduced motion sits the character still whatever its bond', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProgress(page, withBond({ dragon: 50 }));
  const sitting = character(page, 'dragon');
  await expect(sitting).toBeVisible();
  expect(await sitting.evaluate(animates)).toBe(false);
  await expectMeter(page, 50, 25, 50);
});
