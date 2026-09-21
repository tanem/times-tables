import type { Page } from '@playwright/test';
import type { Outcome } from '../src/model/level';
import { expect, test, type HeardNote } from './fixtures';
import {
  advance,
  answerCard,
  digitsFor,
  dontKnow,
  finishDrillAfter,
  key,
  PACE_TIMES,
  setVisibility,
  startDrill,
  startHeading,
  WORDS_AT,
} from './helpers';

// The notes played since the app opened, in the order they were started.
async function heard(page: Page): Promise<HeardNote[]> {
  return page.evaluate(() => window.recordedAudio.heard);
}

test('each key of the pad ticks as it is pressed', async ({ page }) => {
  await startDrill(page);
  expect(await heard(page)).toHaveLength(0);

  await key(page, '4').click();
  expect(await heard(page)).toHaveLength(1);

  await key(page, 'Delete').click();
  expect(await heard(page)).toHaveLength(2);
});

// The notes played while the given steps ran.
async function heardDuring(
  page: Page,
  steps: () => Promise<void>,
): Promise<HeardNote[]> {
  const before = (await heard(page)).length;
  await steps();
  return (await heard(page)).slice(before);
}

// The notes the feedback played for an answer given the given way: those
// after the ticks of the digits and of Enter.
async function outcomeNotes(
  page: Page,
  outcome: Outcome,
): Promise<HeardNote[]> {
  const ticks = (await digitsFor(page, outcome)).length + 1;
  const notes = await heardDuring(page, () => answerCard(page, outcome));
  return notes.slice(ticks);
}

test('a fast answer sounds with the feedback, higher for each answer in a streak', async ({
  page,
}) => {
  await startDrill(page);

  const first = await outcomeNotes(page, 'fast');
  await advance(page);
  const second = await outcomeNotes(page, 'fast');

  expect(first.length).toBeGreaterThan(0);
  expect(second).toHaveLength(first.length);
  expect(second[0]?.freq).toBeGreaterThan(first[0]?.freq ?? Infinity);
});

test('a slow answer and a miss each sound with the feedback, the miss lower', async ({
  page,
}) => {
  await startDrill(page, PACE_TIMES);

  const slow = await outcomeNotes(page, 'slow');
  await advance(page);
  const missed = await outcomeNotes(page, 'missed');
  await advance(page);
  // "I don't know" is not a key of the pad, so the miss is all that sounds.
  const gaveUp = await heardDuring(page, () => dontKnow(page).click());

  expect(slow.length).toBeGreaterThan(0);
  expect(missed.length).toBeGreaterThan(0);
  expect(missed[0]?.freq).toBeLessThan(slow[0]?.freq ?? 0);
  expect(gaveUp).toEqual(missed);
});

test('the end screen plays a run up', async ({ page }) => {
  await startDrill(page);

  const run = await heardDuring(page, async () => {
    await page.getByRole('button', { name: 'Quit' }).click();
    await expect(page.getByRole('button', { name: 'Go again' })).toBeVisible();
  });

  expect(run.length).toBeGreaterThan(1);
  for (let i = 1; i < run.length; i++) {
    expect(run[i]?.freq).toBeGreaterThan(run[i - 1]?.freq ?? Infinity);
    expect(run[i]?.at).toBeGreaterThan(run[i - 1]?.at ?? Infinity);
  }
});

test('the improvement sweep plays as the race ends and not before', async ({
  page,
}) => {
  await finishDrillAfter(page, 15000);

  const duringRace = await heardDuring(page, () =>
    page.clock.runFor(WORDS_AT - 1),
  );
  const sweep = await heardDuring(page, () => page.clock.runFor(1));

  expect(duringRace).toEqual([]);
  expect(sweep).toHaveLength(4);
});

test('the improvement sweep does not follow the learner off the end screen', async ({
  page,
}) => {
  await finishDrillAfter(page, 15000);

  const notes = await heardDuring(page, async () => {
    await page.getByRole('button', { name: 'Home' }).click();
    await expect(startHeading(page)).toBeVisible();
    await page.clock.runFor(WORDS_AT);
  });

  expect(notes).toEqual([]);
});

test('sound comes back when the app returns from the background', async ({
  page,
}) => {
  await startDrill(page);
  await setVisibility(page, 'hidden');
  await page.evaluate(() => {
    window.recordedAudio.state = 'interrupted';
  });

  await setVisibility(page, 'visible');

  expect(await page.evaluate(() => window.recordedAudio.resumed)).toBe(1);
  expect(await heardDuring(page, () => key(page, '4').click())).toHaveLength(1);
});

test('Enter does not tick while it is disabled', async ({ page }) => {
  await startDrill(page);
  await expect(key(page, 'Enter')).toBeDisabled();

  const notes = await heardDuring(page, () =>
    key(page, 'Enter').dispatchEvent('pointerdown', { button: 0 }),
  );

  expect(notes).toEqual([]);
});
