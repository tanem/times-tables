import type { Page } from '@playwright/test';
import { freshProgress, type Progress } from '../src/model/progress';
import { BACKUP_KEY, PROGRESS_KEY } from '../src/storage';
import { expect, test } from './fixtures';
import {
  animates,
  dragon,
  ALL_TILES,
  expectNoTableOn,
  practiseButton,
  seedProgress,
  startHeading,
  storedProgress,
  tile,
  TILES,
} from './helpers';

test('a first launch has nothing on and asks for a tap', async ({ page }) => {
  await page.goto('./');
  await expect(startHeading(page)).toBeVisible();
  for (const name of ALL_TILES) {
    await expect(tile(page, name)).toHaveAttribute('aria-pressed', 'false');
  }
  await expectNoTableOn(page);
  await expect(page.getByText('Which tables?')).toHaveCount(0);
  await expect(dragon(page, 'waves')).toBeVisible();
});

test('the first table switched on ends the nudge, and clearing every table brings it back', async ({
  page,
}) => {
  await page.goto('./');
  await tile(page, '7s').click();

  await expect(page.getByText('Which tables?')).toBeVisible();
  await expect(page.getByText('Tap the tables you want')).toHaveCount(0);
  await expect(
    page.getByRole('img', { name: 'The dragon', exact: true }),
  ).toBeVisible();
  await expect(practiseButton(page)).toBeEnabled();
  await expect(practiseButton(page)).toHaveAccessibleDescription(
    '20 facts from the 7s',
  );

  await tile(page, '7s').click();
  await expectNoTableOn(page);
  await expect(dragon(page, 'waves')).toBeVisible();
});

test('the tiles pulse and the dragon waves only while nothing is on', async ({
  page,
}) => {
  await page.goto('./');
  await expect(tile(page, '2s')).toBeVisible();
  expect(await tile(page, '2s').evaluate(animates)).toBe(true);
  expect(await tile(page, 'All').evaluate(animates)).toBe(true);
  expect(
    await dragon(page, 'waves').locator('.arm-right').evaluate(animates),
  ).toBe(true);

  await tile(page, '2s').click();
  await expect(dragon(page, 'waves')).toHaveCount(0);
  expect(await tile(page, '2s').evaluate(animates)).toBe(false);
  expect(await tile(page, '3s').evaluate(animates)).toBe(false);
});

test('reduced motion drops the pulse and the wave', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expectNoTableOn(page);
  expect(await tile(page, '2s').evaluate(animates)).toBe(false);

  // The dragon sits still, and is not said to wave.
  await expect(dragon(page, 'waves')).toHaveCount(0);
  const sitting = page.getByRole('img', { name: 'The dragon', exact: true });
  await expect(sitting).toBeVisible();
  expect(await sitting.evaluate(animates)).toBe(false);
  expect(await sitting.locator('.arm-right').evaluate(animates)).toBe(false);
});

test('the dragon sits with the app’s name at the top of the Start screen', async ({
  page,
}) => {
  await page.goto('./');
  const theDragon = page.getByRole('img', { name: /^The dragon/ });
  await expect(theDragon).toBeVisible();

  const dragonBox = await theDragon.boundingBox();
  const nameBox = await startHeading(page).boundingBox();
  const questionBox = await page
    .getByText('Tap the tables you want')
    .boundingBox();
  if (!dragonBox || !nameBox || !questionBox) throw new Error('not laid out');
  expect(dragonBox.y + dragonBox.height).toBeLessThanOrEqual(questionBox.y);
  expect(nameBox.y + nameBox.height).toBeLessThanOrEqual(questionBox.y);
});

test('the Start screen has no Speed run button and no best time', async ({
  page,
}) => {
  await page.goto('./');
  await expect(startHeading(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Speed run' })).toHaveCount(0);
  await expect(page.getByText(/best/i)).toHaveCount(0);
});

test('the caption lists up to three tables and counts from four', async ({
  page,
}) => {
  await page.goto('./');
  const practise = practiseButton(page);

  await tile(page, '10s').click();
  await expect(practise).toHaveAccessibleDescription('20 facts from the 10s');

  await tile(page, '2s').click();
  await expect(practise).toHaveAccessibleDescription(
    '20 facts from the 2s and 10s',
  );

  await tile(page, '5s').click();
  await expect(practise).toHaveAccessibleDescription(
    '20 facts from the 2s, 5s and 10s',
  );

  await tile(page, '3s').click();
  await expect(practise).toHaveAccessibleDescription('20 facts from 4 tables');

  await tile(page, '3s').click();
  await expect(tile(page, '3s')).toHaveAttribute('aria-pressed', 'false');
  await expect(practise).toHaveAccessibleDescription(
    '20 facts from the 2s, 5s and 10s',
  );
});

test('the All tile switches every table on, and off when all are on', async ({
  page,
}) => {
  await page.goto('./');
  const practise = practiseButton(page);

  await tile(page, 'All').click();
  for (const name of ALL_TILES) {
    await expect(tile(page, name)).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(practise).toHaveAccessibleDescription(
    '20 facts from all 11 tables',
  );
  expect((await storedProgress(page)).tables).toEqual([
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);

  // One table off: All no longer shows as pressed, and pressing it fills the
  // grid again.
  await tile(page, '9s').click();
  await expect(tile(page, 'All')).toHaveAttribute('aria-pressed', 'false');
  await expect(practise).toHaveAccessibleDescription('20 facts from 10 tables');
  await tile(page, 'All').click();
  await expect(tile(page, '9s')).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, 'All')).toHaveAttribute('aria-pressed', 'true');

  await tile(page, 'All').click();
  await expectNoTableOn(page);
  expect((await storedProgress(page)).tables).toEqual([]);
});

test('switching on the last table by hand presses the All tile', async ({
  page,
}) => {
  await page.goto('./');
  for (const name of TILES) await tile(page, name).click();
  await expect(tile(page, 'All')).toHaveAttribute('aria-pressed', 'true');
});

test('a changed selection is still there after a reload', async ({ page }) => {
  await page.goto('./');
  await tile(page, '4s').click();
  await tile(page, '11s').click();
  await expect(tile(page, '11s')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(tile(page, '4s')).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, '11s')).toHaveAttribute('aria-pressed', 'true');
  await expect(tile(page, '6s')).toHaveAttribute('aria-pressed', 'false');
  await expect(practiseButton(page)).toHaveAccessibleDescription(
    '20 facts from the 4s and 11s',
  );
});

test('a selection made before the tables widened is kept', async ({ page }) => {
  await seedProgress(page, { ...freshProgress(), tables: [6, 8, 12] });
  await expect(page.getByText('Which tables?')).toBeVisible();
  for (const name of ['6s', '8s', '12s']) {
    await expect(tile(page, name)).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(3);
  await expect(practiseButton(page)).toHaveAccessibleDescription(
    '20 facts from the 6s, 8s and 12s',
  );
});

// How full a tile's meter is, from 0 to 1, as it is drawn.
async function meterShare(page: Page, name: string): Promise<number> {
  return tile(page, name).evaluate((el) => {
    const meter = el.querySelector('.meter');
    const fill = meter?.firstElementChild;
    if (!meter || !fill) throw new Error('no meter');
    return (
      fill.getBoundingClientRect().width / meter.getBoundingClientRect().width
    );
  });
}

test('each tile carries a meter of the share of its facts at level 4, without numbers', async ({
  page,
}) => {
  const known = { level: 4, best: 4, fast: 9, slow: 0, missed: 0 } as const;
  const facts: Progress['facts'] = {
    // Six of the twelve facts of the 3s, one of them shared with the 9s.
    '1x3': known,
    '2x3': known,
    '3x3': known,
    '3x4': known,
    '3x5': known,
    '3x9': known,
    // Not yet known, so it counts towards nothing.
    '3x7': { level: 3, best: 3, fast: 5, slow: 1, missed: 0 },
  };
  // Six facts at level 4 and one at level 3 have paid 27.
  await seedProgress(page, {
    ...freshProgress(),
    tables: [3],
    facts,
    gems: 27,
  });

  expect(await meterShare(page, '3s')).toBeCloseTo(0.5, 2);
  // Never switched on, and known through the 3s.
  expect(await meterShare(page, '9s')).toBeCloseTo(1 / 12, 2);
  expect(await meterShare(page, '7s')).toBe(0);
  await expect(tile(page, 'All').locator('.meter')).toHaveCount(0);

  // The meter adds nothing to a tile's name and shows no numbers.
  await expect(tile(page, '3s')).toHaveText('3s');
});

// A backup left by an earlier corrupt document, which the next one replaces.
const EARLIER_BACKUP = '{"version":3,"tables":"old"}';

const corruptDocuments: ReadonlyArray<readonly [string, string]> = [
  ['fails to parse', '{"version":3,'],
  [
    'fails the schema',
    '{"version":3,"tables":[6],"facts":{},"gems":0,"character":"dragon","times":[]}',
  ],
  [
    'holds a level out of range',
    '{"version":3,"tables":[6],"facts":{"6x7":{"level":9,"best":9,"fast":0,"slow":0,"missed":0}},"gems":9,"character":"dragon","times":[],"records":[]}',
  ],
  [
    'has a version given as a string',
    '{"version":"3","tables":[6],"facts":{},"gems":0,"character":"dragon","times":[],"records":[]}',
  ],
  [
    'holds a character its gems have not unlocked',
    '{"version":3,"tables":[6],"facts":{},"gems":24,"character":"cat","times":[],"records":[]}',
  ],
];

for (const [kind, text] of corruptDocuments) {
  test(`a document that ${kind} is backed up and the app starts fresh`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ entries }: { entries: [string, string][] }) => {
        for (const [key, value] of entries) localStorage.setItem(key, value);
      },
      {
        entries: [
          [PROGRESS_KEY, text],
          [BACKUP_KEY, EARLIER_BACKUP],
        ] as [string, string][],
      },
    );
    await page.goto('./');

    await expectNoTableOn(page);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), BACKUP_KEY),
    ).toBe(text);
  });
}

test('a write that throws does not stop the tiles from toggling', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('storage is full');
    };
  });
  await page.goto('./');

  await tile(page, '6s').click();
  await expect(tile(page, '6s')).toHaveAttribute('aria-pressed', 'true');
  await expect(practiseButton(page)).toHaveAccessibleDescription(
    '20 facts from the 6s',
  );
});

// Where the tops of the named tiles are, to the nearest pixel. Tiles with
// the same top share a row.
async function tops(page: Page, names: readonly string[]): Promise<number[]> {
  const found: number[] = [];
  for (const name of names) {
    const box = await tile(page, name).boundingBox();
    if (!box) throw new Error(`${name} is not laid out`);
    found.push(Math.round(box.y));
  }
  return found;
}

for (const [orientation, width, height, columns] of [
  ['portrait', 820, 1180, 4],
  ['landscape', 1180, 820, 6],
  // The smallest iPad screen.
  ['portrait', 768, 1024, 4],
  ['landscape', 1024, 768, 6],
] as const) {
  test(`the Start screen fits a ${width} × ${height} iPad in ${orientation}, ${columns} tiles to a row`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('./');

    const parts = [
      page.getByRole('img', { name: /^The dragon/ }),
      startHeading(page),
      ...ALL_TILES.map((name) => tile(page, name)),
      practiseButton(page),
      page.getByText('Pick a table to practise'),
      page.getByRole('button', { name: 'For parents' }),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <=
          document.documentElement.clientHeight,
      ),
    ).toBe(true);

    // With everything on, the sitting dragon and the longest caption fit too.
    await tile(page, 'All').click();
    await expect(page.getByText('20 facts from all 11 tables')).toBeInViewport({
      ratio: 1,
    });
    await expect(
      page.getByRole('button', { name: 'For parents' }),
    ).toBeInViewport({ ratio: 1 });

    // The twelve cells fill whole rows, and a tile is a square. Measured
    // with a table on, when the tiles are not pulsing.
    const rows = new Map<number, number>();
    for (const top of await tops(page, ALL_TILES)) {
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }
    expect([...rows.values()]).toEqual(Array(12 / columns).fill(columns));
    const box = await tile(page, '2s').boundingBox();
    expect(box?.width).toBeCloseTo(box?.height ?? 0, 0);
  });
}
