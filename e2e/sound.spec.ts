import type { Page } from '@playwright/test';
import type { Outcome } from '../src/model/level';
import { expect, test, type HeardNote } from './fixtures';
import {
  advance,
  answerCard,
  digitsFor,
  dontKnow,
  finishDrillAfter,
  GEM_AT,
  gemPaid,
  key,
  PACE_TIMES,
  setVisibility,
  startDrill,
  startDrillAfter,
  startHeading,
  DIALOG_AFTER_WORDS_AT,
  unlockDialog,
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

test('the gem chime plays as the gem shows, after the fast answer’s sound and not before', async ({
  page,
}) => {
  await startDrill(page);

  const fast = await outcomeNotes(page, 'fast');
  const beforeTheGem = await heardDuring(page, () =>
    page.clock.runFor(GEM_AT - 1),
  );
  const chime = await heardDuring(page, () => page.clock.runFor(1));

  expect(fast).toHaveLength(2);
  expect(beforeTheGem).toEqual([]);
  expect(chime).toHaveLength(2);
  await expect(gemPaid(page)).toHaveText('+1 gem');
});

test('a fast answer that pays no gem plays no chime', async ({ page }) => {
  await startDrillAfter(page, 15000);

  const fast = await outcomeNotes(page, 'fast');
  const afterwards = await heardDuring(page, () => page.clock.runFor(GEM_AT));

  expect(fast).toHaveLength(2);
  expect(afterwards).toEqual([]);
});

test('the gem chime does not follow the learner off the feedback', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');

  const notes = await heardDuring(page, async () => {
    await advance(page);
    await expect(page.getByText('2 / 20')).toBeVisible();
    await page.clock.runFor(GEM_AT);
  });

  expect(notes).toEqual([]);
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

test('the unlock fanfare plays with the dialog and not before', async ({
  page,
}) => {
  // 166 gems, the bonus of 2 and band pay of 3 cross the unicorn's 170.
  await finishDrillAfter(page, 15000, { earned: 166 });
  await page.clock.runFor(WORDS_AT);

  const afterTheSweep = await heardDuring(page, () =>
    page.clock.runFor(DIALOG_AFTER_WORDS_AT - WORDS_AT - 1),
  );
  const fanfare = await heardDuring(page, () => page.clock.runFor(1));

  expect(afterTheSweep).toEqual([]);
  expect(fanfare).toHaveLength(5);
  await expect(unlockDialog(page)).toBeVisible();
});

// The two ways off the end screen, and what each lands on.
const WAYS_OFF = [
  ['Home', (page: Page) => startHeading(page)],
  ['Go again', (page: Page) => page.getByText('1 / 20')],
] as const;

for (const [action, landing] of WAYS_OFF) {
  test(`the improvement sweep does not follow the learner off the end screen by ${action}`, async ({
    page,
  }) => {
    await finishDrillAfter(page, 15000);

    const notes = await heardDuring(page, async () => {
      await page.getByRole('button', { name: action }).click();
      await expect(landing(page)).toBeVisible();
      await page.clock.runFor(WORDS_AT);
    });

    expect(notes).toEqual([]);
  });

  test(`leaving by ${action} before the dialog brings it forward with the fanfare, and nothing follows the learner off`, async ({
    page,
  }) => {
    await finishDrillAfter(page, 15000, { earned: 166 });

    const fanfare = await heardDuring(page, async () => {
      await page.getByRole('button', { name: action }).click();
      await expect(unlockDialog(page)).toBeVisible();
    });
    const afterwards = await heardDuring(page, async () => {
      await unlockDialog(page).getByRole('button', { name: 'OK' }).click();
      await expect(landing(page)).toBeVisible();
      await page.clock.runFor(DIALOG_AFTER_WORDS_AT);
    });

    expect(fanfare).toHaveLength(5);
    expect(afterwards).toEqual([]);
  });
}

// The top note of the improvement sweep, G7, in whole hertz. No other effect
// reaches it.
const SWEEP_TOP = 3136;

test('a drill that was not faster than last time plays no improvement sweep', async ({
  page,
}) => {
  // The earlier drill's median matches this one's, and a tie does not pay.
  await finishDrillAfter(page, 0);

  const afterTheRunUp = await heardDuring(page, () =>
    page.clock.runFor(WORDS_AT),
  );

  expect(afterTheRunUp).toEqual([]);
  const pitches = (await heard(page)).map((note) => Math.round(note.freq));
  expect(pitches).not.toContain(SWEEP_TOP);
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
