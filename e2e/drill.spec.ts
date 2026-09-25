import type { Locator, Page } from '@playwright/test';
import type { Outcome } from '../src/model/level';
import { freshProgress, type Progress } from '../src/model/progress';
import { expect, test } from './fixtures';
import {
  advance,
  animates,
  answerCard,
  bandPay,
  character,
  confetti,
  dontKnow,
  dragon,
  factOnScreen,
  finishDrillAfter,
  finishDrillFrom,
  GEM_AT,
  gemPaid,
  key,
  momentWords,
  PACE_TIMES,
  pick,
  practiseButton,
  pressEnter,
  race,
  RACE_AT,
  runner,
  SEEDED_TABLES,
  seedProgress,
  setVisibility,
  slot,
  SLOW_TIME,
  sparkles,
  startDrill,
  startDrillAfter,
  storedProgress,
  tile,
  typeAnswer,
  DIALOG_AFTER_WORDS_AT,
  DIALOG_AT,
  unlockDialog,
  WORDS_AT,
} from './helpers';

// How tall the learner sees the part, in pixels.
async function heightOf(part: Locator): Promise<number> {
  const box = await part.boundingBox();
  if (!box) throw new Error('the part is not laid out');
  return box.height;
}

// How far along its lane a runner of the race stands, in pixels.
function alongLane(lane: Locator): Promise<number> {
  return lane.evaluate((el) => parseFloat(getComputedStyle(el).left));
}

// The product of the fact on the card, as the learner would type it.
async function productOnScreen(page: Page): Promise<string> {
  const { x, y } = await factOnScreen(page);
  return String(x * y);
}

test('Practise shows the first fact at once with the position, the keypad and an empty slot', async ({
  page,
}) => {
  await startDrill(page);

  const { x, y } = await factOnScreen(page);
  const tables: readonly number[] = SEEDED_TABLES;
  expect(tables.includes(x) || tables.includes(y)).toBe(true);
  await expect(page.getByText('1 / 20')).toBeVisible();
  for (const digit of '0123456789') {
    await expect(key(page, digit)).toBeVisible();
  }
  await expect(key(page, 'Delete')).toBeVisible();
  await expect(key(page, 'Enter')).toBeDisabled();
  await expect(dontKnow(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quit' })).toBeVisible();
  await expect(slot(page)).toHaveText('');

  // Nothing times the learner where they can see it.
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('typing fills the slot, delete takes the last digit off and an answer holds three digits', async ({
  page,
}) => {
  await startDrill(page);

  await typeAnswer(page, '4');
  await expect(slot(page)).toHaveText('4');
  await expect(key(page, 'Enter')).toBeEnabled();

  await typeAnswer(page, '25');
  await expect(slot(page)).toHaveText('425');
  // A fourth digit is ignored.
  await typeAnswer(page, '9');
  await expect(slot(page)).toHaveText('425');

  await key(page, 'Delete').click();
  await expect(slot(page)).toHaveText('42');
  await key(page, 'Delete').click();
  await key(page, 'Delete').click();
  await expect(slot(page)).toHaveText('');
  await expect(key(page, 'Enter')).toBeDisabled();

  // Delete with nothing typed does nothing.
  await key(page, 'Delete').click();
  await expect(slot(page)).toHaveText('');
});

test('a key types once whether it is tapped or activated from the keyboard', async ({
  page,
}) => {
  await startDrill(page);

  // Enter and Space on a focused key act, as they do on any button.
  await key(page, '7').press('Enter');
  await expect(slot(page)).toHaveText('7');
  await key(page, '7').press('Space');
  await expect(slot(page)).toHaveText('77');

  // A tap types one digit, not two: the press acts and the click it ends in
  // does not act again.
  await key(page, '3').click();
  await expect(slot(page)).toHaveText('773');
});

test('the answer is hidden on the card and shown on the feedback', async ({
  page,
}) => {
  await startDrill(page);
  const { x, y } = await factOnScreen(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `${x} × ${y}`,
  );

  await typeAnswer(page, String(x * y));
  await pressEnter(page);
  await expect(
    page.getByRole('heading', { level: 1, name: `${x} × ${y} = ${x * y}` }),
  ).toBeVisible();
  await expect(page.getByText('Fast!')).toBeVisible();
});

test('a right answer typed with a leading zero is still right', async ({
  page,
}) => {
  // The 6s alone, whose products are all two digits at most, so the leading
  // zero fits inside the three digits the answer holds.
  await page.goto('./');
  await tile(page, '6s').click();
  await practiseButton(page).click();

  await typeAnswer(page, `0${await productOnScreen(page)}`);
  await pressEnter(page);
  await expect(page.getByText('Fast!')).toBeVisible();
});

test('a wrong answer is missed at once, with the answer shown', async ({
  page,
}) => {
  await startDrill(page);
  const { x, y } = await factOnScreen(page);
  await typeAnswer(page, String(x * y + 1));
  await pressEnter(page);

  await expect(
    page.getByRole('heading', { level: 1, name: `${x} × ${y} = ${x * y}` }),
  ).toBeVisible();
  await expect(page.getByText('Next time')).toBeVisible();
});

test('I don’t know is missed, with the answer shown', async ({ page }) => {
  await startDrill(page);
  const { x, y } = await factOnScreen(page);
  await dontKnow(page).click();

  await expect(
    page.getByRole('heading', { level: 1, name: `${x} × ${y} = ${x * y}` }),
  ).toBeVisible();
  await expect(page.getByText('Next time')).toBeVisible();
});

test('every right answer is fast while the learner has no pace', async ({
  page,
}) => {
  await startDrill(page);
  await page.clock.runFor(15_000);
  await typeAnswer(page, await productOnScreen(page));
  await pressEnter(page);

  await expect(page.getByText('Fast!')).toBeVisible();
  // That answer time is how a pace starts.
  expect((await storedProgress(page)).times).toEqual([15_000]);
});

test('with a pace, a right answer well over it is slow and one near it is fast', async ({
  page,
}) => {
  await startDrill(page, PACE_TIMES);
  await page.clock.runFor(SLOW_TIME);
  await typeAnswer(page, await productOnScreen(page));
  await pressEnter(page);
  await expect(page.getByText('Got there!')).toBeVisible();
  await advance(page);

  await page.clock.runFor(1000);
  await typeAnswer(page, await productOnScreen(page));
  await pressEnter(page);
  await expect(page.getByText('Fast!')).toBeVisible();
});

test('a presentation the app went to the background during is slow and its time is not kept', async ({
  page,
}) => {
  await startDrill(page, PACE_TIMES);
  await setVisibility(page, 'hidden');

  await typeAnswer(page, await productOnScreen(page));
  await pressEnter(page);
  await expect(page.getByText('Got there!')).toBeVisible();
  // The answer time sits at the cap, which is not kept.
  expect((await storedProgress(page)).times).toEqual(PACE_TIMES);
});

test('a presentation that appears while the app is in the background is slow and its time is not kept', async ({
  page,
}) => {
  await startDrill(page, PACE_TIMES);
  await answerCard(page, 'fast');

  // The feedback's hold runs out with the app hidden, so the next card is
  // built there and only ever sees the app come back.
  await setVisibility(page, 'hidden');
  await page.clock.runFor(2000);
  await expect(page.getByText('2 / 20')).toBeVisible();
  await setVisibility(page, 'visible');

  await typeAnswer(page, await productOnScreen(page));
  await pressEnter(page);
  await expect(page.getByText('Got there!')).toBeVisible();
  expect((await storedProgress(page)).times).toEqual([...PACE_TIMES, 0]);
});

test('the stored answer times grow by one on a right answer and not on a miss or giving up', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');
  expect((await storedProgress(page)).times).toEqual([0]);
  await advance(page);

  await page.clock.runFor(1200);
  await answerCard(page, 'fast');
  expect((await storedProgress(page)).times).toEqual([0, 1200]);
  await advance(page);

  await answerCard(page, 'missed');
  expect((await storedProgress(page)).times).toEqual([0, 1200]);
  await advance(page);

  await dontKnow(page).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('=');
  expect((await storedProgress(page)).times).toEqual([0, 1200]);
});

test('a drill record holds the pace as the drill ended and the median of its own answer times', async ({
  page,
}) => {
  await startDrill(page, PACE_TIMES);
  for (const elapsed of [0, 2000, 4000]) {
    if (elapsed) await page.clock.runFor(elapsed);
    await typeAnswer(page, await productOnScreen(page));
    await pressEnter(page);
    await advance(page);
  }
  await page.getByRole('button', { name: 'Quit' }).click();

  const stored = await storedProgress(page);
  expect(stored.times).toEqual([...PACE_TIMES, 0, 2000, 4000]);
  // The pace holds at a second: the three new times sit either side of the
  // twenty seeded ones. The median is of the drill's own three alone.
  expect(stored.records[0]).toMatchObject({ pace: 1000, median: 2000 });
});

test('a drill record holds a pace first reached during the drill', async ({
  page,
}) => {
  // One answer time short of a pace as the drill starts.
  await startDrill(page, PACE_TIMES.slice(1));
  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  expect((await storedProgress(page)).records[0]).toMatchObject({
    pace: 1000,
  });
});

test('the feedback moves on by itself after 2 seconds or on a tap', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');

  await page.clock.runFor(1999);
  await expect(page.getByText('Fast!')).toBeVisible();
  await page.clock.runFor(1);
  await expect(page.getByText('2 / 20')).toBeVisible();

  await answerCard(page, 'fast');
  await advance(page);
  await expect(page.getByText('3 / 20')).toBeVisible();
});

test('the feedback moves on for a tap of its own and not for the click that pressed Enter', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');

  // Enter acts on the press, so the release of that same touch lands a
  // click here with no press of its own behind it.
  await page.getByText('Tap to go on').dispatchEvent('click');
  await expect(page.getByText('Fast!')).toBeVisible();

  await advance(page);
  await expect(page.getByText('2 / 20')).toBeVisible();
});

test('a miss shows the answer with a word and holds 2.5 seconds', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'missed');

  await expect(page.getByText('Next time')).toBeVisible();
  await page.clock.runFor(2499);
  await expect(page.getByText('Next time')).toBeVisible();
  await page.clock.runFor(1);
  await expect(page.getByText('2 / 20')).toBeVisible();
});

test('on fast the dragon is the biggest thing on screen, jumps and bursts with sparkles', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');

  await expect(dragon(page, 'jumps')).toBeVisible();
  await expect(sparkles(page)).toBeVisible();
  const dragonHeight = await heightOf(dragon(page, 'jumps'));
  const sum = page.getByRole('heading', { level: 1 });
  expect(dragonHeight).toBeGreaterThan(2 * (await heightOf(sum)));
  expect(dragonHeight).toBeGreaterThan(
    2 * (await heightOf(page.getByText('Fast!'))),
  );

  // The burst fades and goes while the feedback is still up.
  await page.clock.runFor(1300);
  await expect(sparkles(page)).toHaveCount(0);
  await expect(page.getByText('Fast!')).toBeVisible();
});

test('on slow the dragon nods with no sparkles', async ({ page }) => {
  await startDrill(page, PACE_TIMES);
  await answerCard(page, 'slow');

  await expect(dragon(page, 'nods')).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);
});

test('on missed the fact and answer are the biggest thing on screen and the dragon shrugs small in the top corner', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'missed');

  const shrugging = dragon(page, 'shrugs');
  await expect(shrugging).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);

  const sumBox = await page.getByRole('heading', { level: 1 }).boundingBox();
  const dragonBox = await shrugging.boundingBox();
  const viewport = page.viewportSize();
  if (!sumBox || !dragonBox || !viewport) throw new Error('not laid out');
  expect(sumBox.height).toBeGreaterThan(dragonBox.height);
  expect(sumBox.width).toBeGreaterThan(3 * dragonBox.width);
  // The top right corner, clear of the sum.
  expect(dragonBox.x).toBeGreaterThan(viewport.width / 2);
  expect(dragonBox.y + dragonBox.height).toBeLessThan(sumBox.y);
});

test('the words rotate through each outcome’s set', async ({ page }) => {
  await startDrill(page);
  for (const word of ['Fast!', 'Zoom!', 'Yes!', 'Fast!']) {
    await answerCard(page, 'fast');
    await expect(page.getByText(word)).toBeVisible();
    await advance(page);
  }
  for (const word of ['Next time', 'Tricky one']) {
    await answerCard(page, 'missed');
    await expect(page.getByText(word)).toBeVisible();
    await advance(page);
  }
});

test('the streak shows from the second fast answer in a row and goes after a slow or a miss', async ({
  page,
}) => {
  await startDrill(page, PACE_TIMES);
  await answerCard(page, 'fast');
  await expect(page.getByText('in a row')).toHaveCount(0);
  await advance(page);

  await answerCard(page, 'fast');
  await expect(page.getByText('2 in a row')).toBeVisible();
  await advance(page);

  await answerCard(page, 'fast');
  await expect(page.getByText('3 in a row')).toBeVisible();
  await advance(page);

  await answerCard(page, 'missed');
  await expect(page.getByText('in a row')).toHaveCount(0);
  await advance(page);

  await answerCard(page, 'fast');
  await expect(page.getByText('in a row')).toHaveCount(0);
  await advance(page);

  await answerCard(page, 'fast');
  await expect(page.getByText('2 in a row')).toBeVisible();
  await advance(page);

  await answerCard(page, 'slow');
  await expect(page.getByText('in a row')).toHaveCount(0);
});

// A whole drill: 14 fast, 4 slow and 2 missed, with the best streak of 5 in
// the middle.
const FULL_DRILL: Outcome[] = [
  'fast',
  'fast',
  'slow',
  'fast',
  'missed',
  'fast',
  'fast',
  'fast',
  'fast',
  'fast',
  'slow',
  'fast',
  'fast',
  'missed',
  'fast',
  'slow',
  'fast',
  'fast',
  'slow',
  'fast',
];

test('after 20 presentations the end screen shows the heading, the tally and the best streak', async ({
  page,
}) => {
  await startDrill(page, PACE_TIMES);
  const shown: string[] = [];
  for (const [index, outcome] of FULL_DRILL.entries()) {
    await expect(page.getByText(`${index + 1} / 20`)).toBeVisible();
    const { x, y } = await factOnScreen(page);
    const factKey = `${Math.min(x, y)}x${Math.max(x, y)}`;
    // No fact comes back within three presentations of itself.
    expect(shown.slice(-3)).not.toContain(factKey);
    shown.push(factKey);
    await answerCard(page, outcome);
    await advance(page);
  }

  await expect(
    page.getByRole('heading', { level: 1, name: 'Drill done!' }),
  ).toBeVisible();
  await expect(page.getByText('14 Fast')).toBeVisible();
  await expect(page.getByText('4 Slow')).toBeVisible();
  await expect(page.getByText('2 Missed')).toBeVisible();
  await expect(page.getByText('Best streak: 5')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go again' })).toBeVisible();

  const stored = await storedProgress(page);
  expect(stored.records).toEqual([
    {
      // The fixed date plus the four slow answers' 3 seconds each.
      at: '2026-01-01T09:00:12.000Z',
      tables: [6, 8, 12],
      fast: 14,
      slow: 4,
      missed: 2,
      quit: false,
      // The twenty seeded times outnumber the drill's own, so the pace holds
      // at a second. The drill answered 14 facts on the instant and 4 after
      // three seconds, so the median of its own times is 0.
      pace: 1000,
      known: 0,
      median: 0,
    },
  ]);
  const facts = Object.values(stored.facts);
  expect(facts.reduce((sum, fact) => sum + fact.fast, 0)).toBe(14);
  expect(facts.reduce((sum, fact) => sum + fact.slow, 0)).toBe(4);
  expect(facts.reduce((sum, fact) => sum + fact.missed, 0)).toBe(2);
});

// Runs a whole drill with the given number of fast answers and the rest
// missed, and lands on the end screen.
async function finishDrill(page: Page, fast: number): Promise<void> {
  await startDrill(page);
  for (let index = 0; index < 20; index++) {
    await answerCard(page, index < fast ? 'fast' : 'missed');
    await advance(page);
  }
  await expect(
    page.getByRole('heading', { level: 1, name: 'Drill done!' }),
  ).toBeVisible();
}

test('a drill with 15 fast answers ends with confetti and a big jump, and pays 3 gems for its band', async ({
  page,
}) => {
  await finishDrill(page, 15);

  await expect(dragon(page, 'jumps high')).toBeVisible();
  await expect(confetti(page)).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);
  await expect(bandPay(page)).toHaveText('+3 gems for this drill');
  // Each fast answer took a fact to a new level and paid a gem.
  expect(await storedProgress(page)).toMatchObject({
    earned: 18,
    balance: 18,
  });

  // The confetti falls once and goes.
  await page.clock.runFor(2400);
  await expect(confetti(page)).toHaveCount(0);
  await expect(dragon(page, 'jumps high')).toBeVisible();
});

for (const fast of [14, 8]) {
  test(`a drill with ${fast} fast answers ends with sparkles and a hop, and pays 1 gem for its band`, async ({
    page,
  }) => {
    await finishDrill(page, fast);

    await expect(dragon(page, 'hops')).toBeVisible();
    await expect(sparkles(page)).toBeVisible();
    await expect(confetti(page)).toHaveCount(0);
    await expect(bandPay(page)).toHaveText('+1 gem for this drill');
    expect(await storedProgress(page)).toMatchObject({
      earned: fast + 1,
      balance: fast + 1,
    });
  });
}

test('a drill faster than last time runs a race, then says so and stands the dragon proud', async ({
  page,
}) => {
  // The earlier drill's median is 15 seconds; every answer of this one is
  // given on the instant. Twenty fast answers celebrate with a big jump.
  await finishDrillAfter(page, 15000);

  // The track holds its place from the start and the words say nothing yet.
  await expect(race(page)).toBeHidden();
  await expect(momentWords(page)).toBeEmpty();
  await expect(dragon(page, 'jumps high')).toBeVisible();

  await page.clock.runFor(RACE_AT);
  await expect(race(page)).toBeVisible();
  await expect(momentWords(page)).toBeEmpty();
  await expect(dragon(page, 'stands proud')).toHaveCount(0);

  await page.clock.runFor(WORDS_AT - RACE_AT);
  await expect(momentWords(page)).toContainText('Faster than last time!');
  await expect(dragon(page, 'stands proud')).toBeVisible();
  await expect(dragon(page, 'jumps high')).toHaveCount(0);
});

test('a fast answer that takes a fact to a new level shows the gem it paid, a moment into the feedback', async ({
  page,
}) => {
  await startDrill(page);
  await answerCard(page, 'fast');

  // The line holds its place from the start and says nothing yet.
  await expect(gemPaid(page)).toBeAttached();
  await expect(gemPaid(page)).toBeEmpty();
  await page.clock.runFor(GEM_AT - 1);
  await expect(gemPaid(page)).toBeEmpty();

  await page.clock.runFor(1);
  await expect(gemPaid(page)).toHaveText('+1 gem');
  await expect(page.getByText('Fast!')).toBeVisible();
  expect(await storedProgress(page)).toMatchObject({ earned: 1, balance: 1 });
});

test('a fast answer on a fact at its highest level shows no gem, on the same layout', async ({
  page,
}) => {
  await startDrillAfter(page, 15000);
  await answerCard(page, 'fast');

  // The line is there and empty, so the character and the word sit where
  // they do when a gem is paid.
  await page.clock.runFor(GEM_AT);
  await expect(gemPaid(page)).toBeAttached();
  await expect(gemPaid(page)).toBeEmpty();
  await expect(page.getByText('Fast!')).toBeVisible();
});

test('a slow answer and a miss show no gem', async ({ page }) => {
  await startDrill(page, PACE_TIMES);
  await answerCard(page, 'slow');
  await page.clock.runFor(GEM_AT);
  await expect(gemPaid(page)).toHaveCount(0);

  await advance(page);
  await answerCard(page, 'missed');
  await page.clock.runFor(GEM_AT);
  await expect(gemPaid(page)).toHaveCount(0);
});

test('the chosen character reacts on the feedback, the end screen and the race in the dragon’s place', async ({
  page,
}) => {
  await finishDrillAfter(page, 15000, { character: 'cat' });

  await expect(character(page, 'cat', 'jumps high')).toBeVisible();
  await expect(dragon(page, 'jumps high')).toHaveCount(0);
  await expect(race(page).locator('.character')).toHaveCount(2);
  for (const lane of ['earlier', 'today'] as const) {
    await expect(runner(page, lane).locator('.character')).toHaveAttribute(
      'aria-label',
      'The cat',
    );
  }

  await page.clock.runFor(WORDS_AT);
  await expect(character(page, 'cat', 'stands proud')).toBeVisible();

  await page.getByRole('button', { name: 'Go again' }).click();
  await answerCard(page, 'fast');
  await expect(character(page, 'cat', 'jumps')).toBeVisible();
  await advance(page);
  await answerCard(page, 'missed');
  await expect(character(page, 'cat', 'shrugs')).toBeVisible();
});

test('a drill faster than last time pays a bonus of two gems beside its band pay', async ({
  page,
}) => {
  await finishDrillAfter(page, 15000);

  // Every fact was already at level 4, so the 132 they had paid is all the
  // drill's own answers were worth. The bonus and top band pay add 5.
  expect(await storedProgress(page)).toMatchObject({
    earned: 137,
    balance: 137,
  });
});

test('a drill that was not faster than last time says nothing and pays no bonus', async ({
  page,
}) => {
  // The earlier drill's median matches this one's, and a tie does not pay.
  await finishDrillAfter(page, 0);

  await page.clock.runFor(WORDS_AT);
  await expect(race(page)).toHaveCount(0);
  await expect(momentWords(page)).toHaveCount(0);
  // Top band pay is all it earned.
  await expect(bandPay(page)).toHaveText('+3 gems for this drill');
  expect(await storedProgress(page)).toMatchObject({
    earned: 135,
    balance: 135,
  });
});

test('a quit drill says nothing and pays nothing however fast it was', async ({
  page,
}) => {
  await startDrillAfter(page, 15000);
  for (let index = 0; index < 12; index++) {
    await answerCard(page, 'fast');
    await advance(page);
  }
  await page.getByRole('button', { name: 'Quit' }).click();

  await page.clock.runFor(WORDS_AT);
  await expect(race(page)).toHaveCount(0);
  await expect(momentWords(page)).toHaveCount(0);
  await expect(bandPay(page)).toHaveCount(0);
  expect(await storedProgress(page)).toMatchObject({
    earned: 132,
    balance: 132,
  });
});

test('reduced motion leaves the runners where the race ends them and still says so', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await finishDrillAfter(page, 15000);
  await page.clock.runFor(RACE_AT);

  const earlier = runner(page, 'earlier');
  const today = runner(page, 'today');
  for (const lane of [earlier, today]) {
    expect(await lane.evaluate(animates)).toBe(false);
  }
  // Neither runner is still on the start line, and today is the further on.
  expect(await alongLane(earlier)).toBeGreaterThan(0);
  expect(await alongLane(today)).toBeGreaterThan(await alongLane(earlier));

  await page.clock.runFor(WORDS_AT - RACE_AT);
  await expect(momentWords(page)).toContainText('Faster than last time!');
});

test('a drill whose answers unlock a character announces it in a dialog once the celebration has played', async ({
  page,
}) => {
  // 10 gems and 20 paid cross the cat's 25.
  await finishDrillFrom(page, 10);
  await expect(unlockDialog(page)).toHaveCount(0);

  await page.clock.runFor(DIALOG_AT - 1);
  await expect(unlockDialog(page)).toHaveCount(0);

  await page.clock.runFor(1);
  const dialog = unlockDialog(page);
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('img', { name: 'The cat jumps high' }),
  ).toBeVisible();
  await expect(dialog.getByText('The cat', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText('Tap Home, then tap it to play as it'),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'OK' })).toBeFocused();
});

test('a drill whose bonus unlocks a character announces it after the words', async ({
  page,
}) => {
  // 166 gems and top band pay of 3 fall short of the unicorn's 170, and
  // the bonus of 2 crosses it.
  await finishDrillAfter(page, 15000, { earned: 166 });

  await page.clock.runFor(DIALOG_AFTER_WORDS_AT - 1);
  await expect(momentWords(page)).toContainText('Faster than last time!');
  await expect(unlockDialog(page)).toHaveCount(0);

  await page.clock.runFor(1);
  await expect(unlockDialog(page)).toBeVisible();
  await expect(
    unlockDialog(page).getByRole('img', { name: 'The unicorn jumps high' }),
  ).toBeVisible();
});

test('the dialog closes on OK and does not switch character, which the Start screen shows unlocked', async ({
  page,
}) => {
  await finishDrillFrom(page, 10);
  await page.clock.runFor(DIALOG_AT);
  const home = page.getByRole('button', { name: 'Home' });
  const before = await home.boundingBox();

  await unlockDialog(page).getByRole('button', { name: 'OK' }).click();

  await expect(unlockDialog(page)).toHaveCount(0);
  expect((await storedProgress(page)).character).toBe('dragon');
  // The dialog sat over the screen, so Home never moved under a finger.
  expect(await home.boundingBox()).toEqual(before);
  await home.click();
  await expect(pick(page, 'Cat')).toHaveAccessibleName('Cat');
  await expect(pick(page, 'Dragon')).toHaveAttribute('aria-pressed', 'true');
});

test('a drill that crosses no unlock total announces nothing', async ({
  page,
}) => {
  // 132, the bonus of 2 and band pay of 3 fall short of the unicorn's 170.
  await finishDrillAfter(page, 15000);

  await page.clock.runFor(DIALOG_AFTER_WORDS_AT);
  await expect(unlockDialog(page)).toHaveCount(0);
});

test('a character unlocked before the drill is not announced', async ({
  page,
}) => {
  // The cat unlocked at 25 gems earlier, with no dialog to show for it,
  // and 49 is short of the robot's 60.
  await finishDrillFrom(page, 26);

  await page.clock.runFor(DIALOG_AFTER_WORDS_AT);
  await expect(unlockDialog(page)).toHaveCount(0);
});

test('a quit drill whose answers unlocked a character announces it too', async ({
  page,
}) => {
  await seedProgress(page, {
    ...freshProgress(),
    tables: [...SEEDED_TABLES],
    earned: 20,
    balance: 20,
  });
  await practiseButton(page).click();
  for (let index = 0; index < 5; index++) {
    await answerCard(page, 'fast');
    await advance(page);
  }
  await page.getByRole('button', { name: 'Quit' }).click();

  await page.clock.runFor(DIALOG_AT);
  await expect(
    unlockDialog(page).getByRole('img', { name: 'The cat jumps high' }),
  ).toBeVisible();
});

test('leaving before the dialog brings it forward, and OK then leaves', async ({
  page,
}) => {
  await finishDrillAfter(page, 15000, { earned: 166 });
  await page.clock.runFor(RACE_AT);

  await page.getByRole('button', { name: 'Go again' }).click();
  await expect(unlockDialog(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go again' })).toBeVisible();

  await unlockDialog(page).getByRole('button', { name: 'OK' }).click();
  await expect(page.getByText('1 / 20')).toBeVisible();
});

test('Escape closes the dialog as OK does, and focus returns to Home', async ({
  page,
}) => {
  await finishDrillFrom(page, 10);
  await page.clock.runFor(DIALOG_AT);
  await expect(unlockDialog(page)).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(unlockDialog(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Home' })).toBeFocused();
});

test('a drill with 7 fast answers ends with a warm wave and pays nothing for its band', async ({
  page,
}) => {
  await finishDrill(page, 7);

  await expect(dragon(page, 'waves')).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);
  await expect(confetti(page)).toHaveCount(0);
  await expect(bandPay(page)).toHaveCount(0);
  expect(await storedProgress(page)).toMatchObject({ earned: 7, balance: 7 });
});

test('a quit drill ends with a warm wave and pays nothing for its band however many answers were fast', async ({
  page,
}) => {
  await startDrill(page);
  for (let index = 0; index < 15; index++) {
    await answerCard(page, 'fast');
    await advance(page);
  }
  await page.getByRole('button', { name: 'Quit' }).click();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Stopped early. Still counts!',
    }),
  ).toBeVisible();
  await expect(dragon(page, 'waves')).toBeVisible();
  await expect(sparkles(page)).toHaveCount(0);
  await expect(confetti(page)).toHaveCount(0);
  await expect(bandPay(page)).toHaveCount(0);
  expect(await storedProgress(page)).toMatchObject({
    earned: 15,
    balance: 15,
  });
});

test('the stored document holds the updated level and counts after each answer', async ({
  page,
}) => {
  await startDrill(page);
  const first = await factOnScreen(page);
  const factKey = `${Math.min(first.x, first.y)}x${Math.max(first.x, first.y)}`;
  await answerCard(page, 'fast');
  expect((await storedProgress(page)).facts[factKey]).toEqual({
    level: 1,
    best: 1,
    fast: 1,
    slow: 0,
    missed: 0,
  });
  expect((await storedProgress(page)).records).toEqual([]);
});

test('quitting from the card ends the drill with the answers given so far', async ({
  page,
}) => {
  await startDrill(page);
  for (const outcome of ['fast', 'fast', 'missed'] as const) {
    await answerCard(page, outcome);
    await advance(page);
  }
  await page.getByRole('button', { name: 'Quit' }).click();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Stopped early. Still counts!',
    }),
  ).toBeVisible();
  await expect(page.getByText('2 Fast')).toBeVisible();
  await expect(page.getByText('0 Slow')).toBeVisible();
  await expect(page.getByText('1 Missed')).toBeVisible();
  await expect(page.getByText('Best streak: 2')).toBeVisible();

  const stored = await storedProgress(page);
  expect(stored.records).toHaveLength(1);
  expect(stored.records[0]).toMatchObject({
    fast: 2,
    slow: 0,
    missed: 1,
    quit: true,
  });
});

test('a drill record holds the number of facts at level 4 as the drill ended', async ({
  page,
}) => {
  // The 6s, with two facts at level 4 from outside the 6s, which the drill
  // never presents, and every fact of the 6s one fast answer from level 4.
  const atLevel4 = { level: 4, best: 4, fast: 4, slow: 0, missed: 0 } as const;
  const atLevel3 = { level: 3, best: 3, fast: 3, slow: 0, missed: 0 } as const;
  const facts: Progress['facts'] = { '3x5': atLevel4, '4x9': atLevel4 };
  for (let n = 1; n <= 12; n++) {
    facts[`${Math.min(6, n)}x${Math.max(6, n)}`] = atLevel3;
  }
  const progress: Progress = {
    ...freshProgress(),
    tables: [6],
    facts,
    // Two facts at level 4 and twelve at level 3 have paid 44.
    earned: 44,
    balance: 44,
  };
  await seedProgress(page, progress);
  await practiseButton(page).click();

  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  const stored = await storedProgress(page);
  expect(stored.records).toHaveLength(1);
  expect(stored.records[0]).toMatchObject({ quit: true, known: 3 });
});

test('Go again starts a new drill on the same tables and Home returns to the Start screen', async ({
  page,
}) => {
  await page.goto('./');
  await tile(page, '6s').click();
  await tile(page, '8s').click();
  await practiseButton(page).click();
  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  await page.getByRole('button', { name: 'Go again' }).click();
  await expect(page.getByText('1 / 20')).toBeVisible();
  const { x, y } = await factOnScreen(page);
  expect(x !== 12 && y !== 12).toBe(true);
  await page.getByRole('button', { name: 'Quit' }).click();
  expect((await storedProgress(page)).records.map((r) => r.tables)).toEqual([
    [6, 8],
    [6, 8],
  ]);

  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByText('Which tables?')).toBeVisible();
  await expect(tile(page, '8s')).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, '12s')).toHaveAttribute('aria-pressed', 'false');
});

test('progress survives a reload', async ({ page }) => {
  await startDrill(page);
  await answerCard(page, 'fast');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  await page.reload();
  await practiseButton(page).click();
  await answerCard(page, 'missed');
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();

  const stored = await storedProgress(page);
  expect(stored.records).toHaveLength(2);
  expect(stored.times).toEqual([0]);
  const facts = Object.values(stored.facts);
  expect(facts.reduce((sum, fact) => sum + fact.fast, 0)).toBe(1);
  expect(facts.reduce((sum, fact) => sum + fact.missed, 0)).toBe(1);
});

test('a drill carries on after a write that throws', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('storage is full');
    };
  });
  // Nothing can be seeded, so the table is switched on by hand.
  await page.goto('./');
  await tile(page, '6s').click();
  await practiseButton(page).click();
  await answerCard(page, 'fast');
  await advance(page);
  await answerCard(page, 'fast');
  await expect(page.getByText('2 in a row')).toBeVisible();
  await advance(page);
  await page.getByRole('button', { name: 'Quit' }).click();
  await expect(page.getByText('2 Fast')).toBeVisible();
});

for (const [orientation, width, height] of [
  ['portrait', 820, 1180],
  ['landscape', 1180, 820],
] as const) {
  test(`the card fits an iPad in ${orientation}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await startDrill(page);

    const parts = [
      page.getByRole('button', { name: 'Quit' }),
      page.getByText('1 / 20'),
      page.getByRole('heading', { level: 1 }),
      slot(page),
      dontKnow(page),
      key(page, '1'),
      key(page, '0'),
      key(page, 'Delete'),
      key(page, 'Enter'),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }

    // The next card does not slide in, so what it measures is the settled
    // layout: nothing spills past the viewport in either direction.
    await answerCard(page, 'fast');
    await advance(page);
    const scroll = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    expect(scroll.width).toBeLessThanOrEqual(width);
    expect(scroll.height).toBeLessThanOrEqual(height);
  });

  test(`the feedback fits an iPad in ${orientation}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await startDrill(page);
    await answerCard(page, 'fast');

    const parts = [
      page.getByRole('heading', { level: 1 }),
      dragon(page, 'jumps'),
      page.getByText('Fast!'),
      page.getByText('Tap to go on'),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });

  test(`the missed feedback fits an iPad in ${orientation}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await startDrill(page);
    await answerCard(page, 'missed');

    const parts = [
      page.getByRole('heading', { level: 1 }),
      dragon(page, 'shrugs'),
      page.getByText('Next time'),
      page.getByText('Tap to go on'),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });

  test(`the end of a drill fits an iPad in ${orientation}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await startDrill(page);
    await page.getByRole('button', { name: 'Quit' }).click();

    const parts = [
      dragon(page, 'waves'),
      page.getByRole('heading', { level: 1 }),
      page.getByText('0 Fast'),
      page.getByText('Best streak: 0'),
      page.getByRole('button', { name: 'Home' }),
      page.getByRole('button', { name: 'Go again' }),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });

  test(`the end of a drill faster than last time fits an iPad in ${orientation}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await finishDrillAfter(page, 15000);
    const home = page.getByRole('button', { name: 'Home' });
    const before = await home.boundingBox();

    await page.clock.runFor(WORDS_AT);

    const parts = [
      dragon(page, 'stands proud'),
      page.getByRole('heading', { level: 1 }),
      page.getByText('20 Fast'),
      page.getByText('Best streak: 20'),
      bandPay(page),
      race(page),
      momentWords(page),
      home,
      page.getByRole('button', { name: 'Go again' }),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
    // The moment held its place, so Home never moved under a finger.
    expect(await home.boundingBox()).toEqual(before);
  });

  test(`the dialog for a new character fits an iPad in ${orientation}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await finishDrillAfter(page, 15000, { earned: 166 });

    await page.clock.runFor(DIALOG_AFTER_WORDS_AT);

    const dialog = unlockDialog(page);
    const parts = [
      dialog.getByRole('heading', { level: 2 }),
      dialog.getByRole('img', { name: 'The unicorn jumps high' }),
      dialog.getByText('The unicorn', { exact: true }),
      dialog.getByText('Tap Home, then tap it to play as it'),
      dialog.getByRole('button', { name: 'OK' }),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });
}
