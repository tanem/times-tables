import { expect, type Locator, type Page } from '@playwright/test';
import type { Outcome } from '../src/model/level';
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

// All three table tiles pressed, as the Start screen shows with nothing
// toggled off.
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
  return JSON.parse(text);
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

// Opens the app on a stored document holding the given records, with all
// three tables on.
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

// Taps Practise and lands on the first card of a drill.
export async function startDrill(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByRole('button', { name: 'Practise', exact: true }).click();
}

// Answers the card the given way and lands on the feedback.
export async function answerCard(page: Page, outcome: Outcome): Promise<void> {
  if (outcome === 'slow') await page.clock.runFor(3000);
  const button = outcome === 'missed' ? 'Missed' : 'Got it';
  await page.getByRole('button', { name: button }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('=');
}

// Taps the feedback to move on.
export async function advance(page: Page): Promise<void> {
  await page.getByText('Tap to go on').click();
}
