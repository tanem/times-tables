import { expect, type Locator, type Page } from '@playwright/test';
import type { Outcome } from '../src/model/level';
import { PACE_NEEDED } from '../src/model/pace';
import type { DrillRecord, Progress } from '../src/model/progress';
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

export const TILES = ['6s', '8s', '12s'];

// All three offered table tiles pressed, as the Start screen shows with
// nothing toggled off.
export async function expectAllTablesOn(page: Page): Promise<void> {
  for (const table of TILES) {
    await expect(
      page.getByRole('button', { name: table, pressed: true }),
    ).toBeVisible();
  }
}

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

// The dragon doing the given thing, as its accessible name says.
export function dragon(page: Page, doing: string): Locator {
  return page.getByRole('img', { name: `The dragon ${doing}`, exact: true });
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

// Opens the app on a stored document holding the given records, with the
// three offered tables on.
export async function openWithRecords(
  page: Page,
  records: DrillRecord[],
): Promise<void> {
  const progress: Progress = {
    version: 2,
    tables: [6, 8, 12],
    facts: {},
    times: [],
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

// Taps Practise and lands on the first card of a drill. Given answer times,
// the drill opens on a document holding them, so that the learner has a
// pace and an answer can be graded slow.
export async function startDrill(page: Page, times?: number[]): Promise<void> {
  if (times) {
    await seedProgress(page, {
      version: 2,
      tables: [6, 8, 12],
      facts: {},
      times,
      records: [],
    });
  } else {
    await page.goto('./');
  }
  await page.getByRole('button', { name: 'Practise', exact: true }).click();
}

// Answers the card the given way and lands on the feedback: the product
// typed for a right answer, one past it for a wrong one. A slow answer needs
// the pace startDrill seeds with PACE_TIMES.
export async function answerCard(page: Page, outcome: Outcome): Promise<void> {
  const { x, y } = await factOnScreen(page);
  if (outcome === 'slow') await page.clock.runFor(SLOW_TIME);
  await typeAnswer(page, String(outcome === 'missed' ? x * y + 1 : x * y));
  await pressEnter(page);
}

// Taps the feedback to move on.
export async function advance(page: Page): Promise<void> {
  await page.getByText('Tap to go on').click();
}
