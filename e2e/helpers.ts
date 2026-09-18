import type { Locator, Page } from '@playwright/test';
import type { Progress } from '../src/model/progress';
import { PROGRESS_KEY } from '../src/storage';

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
