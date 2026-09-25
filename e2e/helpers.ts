import { expect, type Locator, type Page } from '@playwright/test';
import type { Character } from '../src/model/characters';
import { pool, TABLES, type Table } from '../src/model/facts';
import type { Outcome } from '../src/model/level';
import { PACE_NEEDED } from '../src/model/pace';
import {
  freshProgress,
  type DrillRecord,
  type Progress,
} from '../src/model/progress';
import { PROGRESS_KEY } from '../src/storage';

// The Progress heading, as the Parent view titles itself.
export function progressHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Progress' });
}

// The Start screen's own heading, "Times tables".
export function startHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Times tables' });
}

// Taps "For parents" and lands on the Parent view.
export async function openParent(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'For parents' }).click();
  await expect(progressHeading(page)).toBeVisible();
}

// The Start screen's table tiles, in order, and the All tile that follows
// them.
export const TILES = TABLES.map((table) => `${table}s`);
export const ALL_TILES = [...TILES, 'All'];

// A tile of the Start screen by its name, "7s" or "All".
export function tile(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

export function practiseButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Practise', exact: true });
}

// The Start screen's tiles, as the group the question heads.
export function tiles(page: Page): Locator {
  return page.getByRole('group', { name: /tables/ });
}

// The Start screen as a first launch or a fresh start shows it: no tile
// pressed, the heading asking for a tap and Practise disabled.
export async function expectNoTableOn(page: Page): Promise<void> {
  await expect(tiles(page).getByRole('button', { pressed: true })).toHaveCount(
    0,
  );
  await expect(page.getByText('Tap the tables you want')).toBeVisible();
  await expect(practiseButton(page)).toBeDisabled();
  await expect(practiseButton(page)).toHaveAccessibleDescription(
    'Pick a table to practise',
  );
}

// The tables the seeded documents switch on. Their pool is 33 facts, small
// enough for a drill to come back to a fact.
export const SEEDED_TABLES: readonly Table[] = [6, 8, 12];

// The fact on the card or the feedback, read the way the learner reads it.
export async function factOnScreen(
  page: Page,
): Promise<{ x: number; y: number }> {
  const heading = page.getByRole('heading', { level: 1 });
  const text = (await heading.textContent()) ?? '';
  const match = /^(\d+) × (\d+)/.exec(text);
  if (!match) throw new Error(`no fact on screen, saw "${text}"`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

// The key of the fact on screen, as the stored document has it.
export async function keyOnScreen(page: Page): Promise<string> {
  const { x, y } = await factOnScreen(page);
  return `${Math.min(x, y)}x${Math.max(x, y)}`;
}

// The progress document as the app last wrote it.
export async function storedProgress(page: Page): Promise<Progress> {
  const text = await page.evaluate(
    (key) => localStorage.getItem(key),
    PROGRESS_KEY,
  );
  if (text === null) throw new Error('nothing stored');
  return JSON.parse(text) as Progress;
}

// The character named doing the given thing, as its accessible name says:
// "The cat jumps", or "The cat" sitting.
export function character(page: Page, name: Character, doing = ''): Locator {
  return page.getByRole('img', {
    name: doing ? `The ${name} ${doing}` : `The ${name}`,
    exact: true,
  });
}

// The dragon doing the given thing.
export function dragon(page: Page, doing: string): Locator {
  return character(page, 'dragon', doing);
}

// The balance on the Start screen, which reads as "27 gems".
export function balance(page: Page): Locator {
  return page.locator('.gems');
}

// The meter under the chosen character on the Start screen, which reads
// its bond.
export function bondMeter(page: Page): Locator {
  return page.getByRole('meter', { name: /^Bond with/ });
}

// The row of characters on the Start screen.
export function characterRow(page: Page): Locator {
  return page.getByRole('group', { name: 'Your character' });
}

// One character in the row, by its name alone: "Cat" whether or not it is
// locked.
export function pick(page: Page, name: string): Locator {
  return characterRow(page).getByRole('button', {
    name: new RegExp(`^${name}`),
  });
}

export function sparkles(page: Page): Locator {
  return page.getByRole('img', { name: 'Sparkles' });
}

export function confetti(page: Page): Locator {
  return page.getByRole('img', { name: 'Confetti' });
}

// A key of the keypad, by the name a screen reader reads out.
export function key(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

// The line the typed digits land on.
export function slot(page: Page): Locator {
  return page.getByRole('status', { name: 'Your answer' });
}

// The button under the slot that gives up on the fact.
export function dontKnow(page: Page): Locator {
  return page.getByRole('button', { name: "I don't know" });
}

// Presses the digit keys of the given answer, in order.
export async function typeAnswer(page: Page, digits: string): Promise<void> {
  for (const digit of digits) await key(page, digit).click();
}

// Presses Enter and lands on the feedback, which shows the sum.
export async function pressEnter(page: Page): Promise<void> {
  await key(page, 'Enter').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('=');
}

// Opens the app on a stored document holding the given records and answer
// times, with the seeded tables on.
export async function openWithRecords(
  page: Page,
  records: DrillRecord[],
  times: number[] = [],
): Promise<void> {
  const progress: Progress = {
    ...freshProgress(),
    tables: [...SEEDED_TABLES],
    times,
    records,
  };
  await page.addInitScript(([key, text]) => localStorage.setItem(key, text), [
    PROGRESS_KEY,
    JSON.stringify(progress),
  ] as const);
  await page.goto('./');
}

// Enough answer times, all the same, for the learner to open a drill with a
// pace of one second.
export const PACE_TIMES: number[] = Array<number>(PACE_NEEDED).fill(1000);

// How long an answer takes to grade slow against that pace: over 1.5 × it
// and past the 3-second floor.
export const SLOW_TIME = 3000;

// Writes the document into the store and opens the app on it. Unlike
// addInitScript this does not seed again on a later reload, so a test that
// reloads reads back what the app itself wrote.
export async function seedProgress(
  page: Page,
  progress: Progress,
): Promise<void> {
  await page.goto('./');
  await page.evaluate(([key, text]) => localStorage.setItem(key, text), [
    PROGRESS_KEY,
    JSON.stringify(progress),
  ] as const);
  await page.goto('./');
}

// Opens the app with the seeded tables on, taps Practise and lands on the
// first card of a drill. Given answer times, the document holds them too, so
// that the learner has a pace and an answer can be graded slow.
export async function startDrill(
  page: Page,
  times: number[] = [],
): Promise<void> {
  await seedProgress(page, {
    ...freshProgress(),
    tables: [...SEEDED_TABLES],
    times,
  });
  await practiseButton(page).click();
}

// A finished drill on the seeded tables with every answer right and the
// given median answer time: the record a drill before this one left.
function lastTimeRecord(median: number): DrillRecord {
  return {
    at: '2025-12-31T09:00:00.000Z',
    tables: [...SEEDED_TABLES],
    fast: 20,
    slow: 0,
    missed: 0,
    quit: false,
    pace: null,
    known: 0,
    median,
  };
}

// The gems the seeded tables' 33 facts have paid once every one of them has
// reached level 4.
const KNOWN_GEMS = 132;

// How the document a drill after last time starts from differs from the
// usual: the chosen character, and an earned total above what the facts
// paid, standing in for bonuses and band pay paid earlier. The balance is
// the whole of it.
export type AfterOptions = {
  character?: Character;
  earned?: number;
};

// Opens the app on a document with the seeded tables on, every fact of their
// pool at level 4 and one earlier finished drill on those tables with the
// given median answer time; then taps Practise and lands on the first card.
// Every fact has paid all four of its gems, so no answer of this drill can
// pay one and the bonus is all that can. The gems have unlocked the owl, so
// any character up to it can be the chosen one.
export async function startDrillAfter(
  page: Page,
  median: number,
  { character = 'dragon', earned = KNOWN_GEMS }: AfterOptions = {},
): Promise<void> {
  const facts: Progress['facts'] = {};
  for (const fact of pool(SEEDED_TABLES)) {
    facts[fact.key] = { level: 4, best: 4, fast: 4, slow: 0, missed: 0 };
  }
  await seedProgress(page, {
    ...freshProgress(),
    tables: [...SEEDED_TABLES],
    facts,
    earned,
    balance: earned,
    character,
    records: [lastTimeRecord(median)],
  });
  await practiseButton(page).click();
}

// When the gem an answer paid shows on the feedback, in milliseconds after
// the feedback shows, with the chime.
export const GEM_AT = 300;

// The gem line of a fast feedback, which reads as "+1 gem" once a gem paid
// shows. It is on screen and empty until then, and stays empty when the
// answer paid nothing.
export function gemPaid(page: Page): Locator {
  return page.locator('.feedback').getByRole('status');
}

// The line on the end screen for what the drill's band paid, which reads as
// "+3 gems for this drill". There is none when the band paid nothing.
export function bandPay(page: Page): Locator {
  return page.locator('.end .pay', { hasText: 'for this drill' });
}

// The lines on the end screen for the badges the drill earned, one per
// table, each reading as "+10 gems for the 7s badge".
export function badgePay(page: Page): Locator {
  return page.locator('.end .pay', { hasText: 'badge' });
}

// The dialog that announces a new character on the end screen.
export function unlockDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'New character!' });
}

// The moment's two beats, in milliseconds after the end screen shows: the
// race starts, then runs for 2200 before the words follow it.
export const RACE_AT = 900;
export const WORDS_AT = 3100;

// When the dialog for a new character shows, in milliseconds after the end
// screen shows: on the race's beat when there is no race, and 1300 after
// the words when there is.
export const DIALOG_AT = 900;
export const DIALOG_AFTER_WORDS_AT = 4400;

// The race track between the learner's earlier self and today.
export function race(page: Page): Locator {
  return page.locator('.race');
}

// One of the race's two runners, in the lane named.
export function runner(page: Page, lane: 'earlier' | 'today'): Locator {
  return page.locator(`.lane.${lane} .runner`);
}

// What the moment says once the race has run, which a screen reader
// announces. It is on screen and empty until then.
export function momentWords(page: Page): Locator {
  return page.locator('.moment').getByRole('status');
}

// Whether the given element is being animated, for a page evaluate.
export const animates = (el: Element) =>
  getComputedStyle(el).animationName !== 'none';

// The digits that answer the fact on screen the given way: the product for a
// right answer, one past it for a wrong one.
export async function digitsFor(page: Page, outcome: Outcome): Promise<string> {
  const { x, y } = await factOnScreen(page);
  return String(outcome === 'missed' ? x * y + 1 : x * y);
}

// Answers the card the given way and lands on the feedback. A slow answer
// needs the pace startDrill seeds with PACE_TIMES.
export async function answerCard(page: Page, outcome: Outcome): Promise<void> {
  const digits = await digitsFor(page, outcome);
  if (outcome === 'slow') await page.clock.runFor(SLOW_TIME);
  await typeAnswer(page, digits);
  await pressEnter(page);
}

// Taps the feedback to move on.
export async function advance(page: Page): Promise<void> {
  await page.getByText('Tap to go on').click();
}

// Answers every card of the drill on the instant and lands on the end
// screen.
export async function answerAllFast(page: Page): Promise<void> {
  for (let index = 0; index < 20; index++) {
    await answerCard(page, 'fast');
    await advance(page);
  }
  await expect(
    page.getByRole('heading', { level: 1, name: 'Drill done!' }),
  ).toBeVisible();
}

// Runs a whole drill of right answers given on the instant, after one
// earlier finished drill on the same tables with the given median answer
// time, and lands on the end screen.
export async function finishDrillAfter(
  page: Page,
  median: number,
  options: AfterOptions = {},
): Promise<void> {
  await startDrillAfter(page, median, options);
  await answerAllFast(page);
}

// Runs a whole drill of right answers given on the instant from a document
// with the seeded tables on, every fact new and the given earned total, all
// of it the balance, and lands on the end screen. Every answer takes its
// fact to a level it has not reached, so the answers pay 20 gems, and the
// top band pays 3.
export async function finishDrillFrom(
  page: Page,
  earned: number,
): Promise<void> {
  await seedProgress(page, {
    ...freshProgress(),
    tables: [...SEEDED_TABLES],
    earned,
    balance: earned,
  });
  await practiseButton(page).click();
  await answerAllFast(page);
  expect((await storedProgress(page)).earned).toBe(earned + 23);
}

// Makes the page report the given visibility and announces the change, as
// the iPad does when the app goes to the background and comes back.
export async function setVisibility(
  page: Page,
  state: 'hidden' | 'visible',
): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => value,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}
