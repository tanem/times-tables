import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { pool, type Table } from '../src/model/facts';
import { BONUS } from '../src/model/bonus';
import type { Level } from '../src/model/level';
import {
  freshProgress,
  type DrillRecord,
  type FactProgress,
  type Progress,
} from '../src/model/progress';
import { expect, test } from './fixtures';
import {
  advance,
  answerCard,
  GEM_AT,
  gemPaid,
  openParent,
  practiseButton,
  seedProgress,
  WORDS_AT,
} from './helpers';

// Writes the README's screenshots to docs/screenshots/, one per screen, from
// an invented learner. Run with `npm run screenshots`, which builds the app
// and runs this file alone under playwright.screenshots.config.ts; the e2e
// config does not match it. Nothing here comes from a real learner.

const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));

// The tables the learner has on today: the 3s and 4s from the start, with
// the 6s and then the 8s switched on along the way, so the chart marks
// where they were added.
const TABLES_ON: Table[] = [3, 4, 6, 8];

// About six weeks of drills up to the fixtures' fixed date, 1 January 2026:
// pace falling from over five seconds to under three, facts known rising,
// and one drill quit early. Each takes its fast, slow and missed counts as
// a triple. Its median answer time sits a little under its pace, as a drill
// of mostly known facts does; the first drill, before there was a pace, is
// given one a little over the first pace.
function record(
  at: string,
  tables: Table[],
  [fast, slow, missed]: [number, number, number],
  pace: number | null,
  known: number,
  quit = false,
): DrillRecord {
  return {
    at: `${at}T09:00:00.000Z`,
    tables,
    fast,
    slow,
    missed,
    quit,
    pace,
    known,
    median: pace === null ? FIRST_MEDIAN : pace - 100,
  };
}

const FIRST_MEDIAN = 5400;

const RECORDS: DrillRecord[] = [
  record('2025-11-20', [3, 4], [9, 6, 5], null, 0),
  record('2025-11-22', [3, 4], [11, 5, 4], 5200, 2),
  record('2025-11-25', [3, 4], [12, 5, 3], 4900, 4),
  record('2025-11-27', [3, 4], [13, 4, 3], 4700, 6),
  record('2025-11-30', [3, 4], [14, 4, 2], 4500, 8),
  record('2025-12-03', [3, 4, 6], [12, 5, 3], 4600, 9),
  record('2025-12-06', [3, 4, 6], [13, 5, 2], 4400, 11),
  record('2025-12-09', [3, 4, 6], [8, 3, 1], 4300, 11, true),
  record('2025-12-11', [3, 4, 6], [15, 3, 2], 4100, 13),
  record('2025-12-14', [3, 4, 6], [16, 3, 1], 3800, 15),
  record('2025-12-17', TABLES_ON, [14, 4, 2], 3900, 16),
  record('2025-12-20', TABLES_ON, [15, 3, 2], 3600, 18),
  record('2025-12-23', TABLES_ON, [16, 3, 1], 3300, 19),
  record('2025-12-27', TABLES_ON, [17, 2, 1], 3000, 21),
  record('2025-12-30', TABLES_ON, [17, 2, 1], 2800, 22),
  record('2025-12-31', TABLES_ON, [18, 1, 1], 2600, 22),
];

// The learner's pace: 60 right answers around 2.6 seconds.
const TIMES: number[] = Array.from(
  { length: 60 },
  (_, index) => 2600 + (((index * 37) % 11) - 5) * 120,
);

// How many of the pool's facts sit at each level, the smallest products
// known best: 22 at level 4, as the last record says, down to 5 still new.
const AT_LEVEL: Record<Level, number> = { 4: 22, 3: 5, 2: 5, 1: 5, 0: 5 };

// Two bonuses paid along the way, on top of what the facts paid.
const BONUSES_PAID = 2;

// The invented learner's facts: the pool of the tables on, by product, each
// at the level its rank gives it, with counts to match.
function facts(): Record<string, FactProgress> {
  const byProduct = [...pool(TABLES_ON)].sort((a, b) => a.product - b.product);
  const levels: Level[] = ([4, 3, 2, 1, 0] as const).flatMap((level) =>
    Array<Level>(AT_LEVEL[level]).fill(level),
  );
  if (levels.length !== byProduct.length) {
    throw new Error(
      `${levels.length} levels for ${byProduct.length} facts in the pool`,
    );
  }
  const result: Record<string, FactProgress> = {};
  byProduct.forEach((fact, index) => {
    const level = levels[index] ?? 0;
    result[fact.key] = {
      level,
      best: level,
      fast: level * 3 + 1,
      slow: level === 0 ? 1 : 2,
      missed: 4 - level,
    };
  });
  return result;
}

// The invented learner's progress document.
function inventedProgress(): Progress {
  const known = facts();
  const paid = Object.values(known).reduce((sum, fact) => sum + fact.best, 0);
  return {
    ...freshProgress(),
    tables: TABLES_ON,
    facts: known,
    gems: paid + BONUS * BONUSES_PAID,
    character: 'owl',
    times: TIMES,
    records: RECORDS,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${OUT}${name}.png`,
    animations: 'disabled',
  });
}

test('the five screens', async ({ page }) => {
  await seedProgress(page, inventedProgress());
  await shoot(page, 'start');

  await openParent(page);
  await shoot(page, 'parent');
  await page.getByRole('button', { name: 'Back' }).click();

  await practiseButton(page).click();
  await shoot(page, 'card');

  // The feedback with the gem the answer paid: the first fast answer on a
  // fact not yet at level 4 pays one, so move on past any that does not.
  let answered = 0;
  for (;;) {
    await answerCard(page, 'fast');
    answered++;
    await page.clock.runFor(GEM_AT);
    if ((await gemPaid(page).textContent())?.includes('+1 gem')) break;
    if (answered === 20) throw new Error('no answer of the drill paid a gem');
    await advance(page);
  }
  await shoot(page, 'feedback');

  // The rest of the drill, every answer on the instant, so the end screen
  // shows the top band and the race against last time.
  for (; answered < 20; answered++) {
    await advance(page);
    await answerCard(page, 'fast');
  }
  await advance(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Drill done!' }),
  ).toBeVisible();
  await page.clock.runFor(WORDS_AT);
  await expect(page.getByText('Faster than last time!')).toBeVisible();
  await shoot(page, 'end');
});
