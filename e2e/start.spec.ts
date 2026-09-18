import type { Page } from '@playwright/test';
import { BACKUP_KEY, PROGRESS_KEY } from '../src/storage';
import { expect, test } from './fixtures';

const TILES = ['6s', '8s', '12s'];

async function expectAllTablesOn(page: Page): Promise<void> {
  for (const table of TILES) {
    await expect(
      page.getByRole('button', { name: table, pressed: true }),
    ).toBeVisible();
  }
}

test('the app opens onto the Start screen with all three tables on', async ({
  page,
}) => {
  await page.goto('./');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Times tables' }),
  ).toBeVisible();
  await expect(page.getByText('Which tables?')).toBeVisible();
  await expectAllTablesOn(page);
  const practise = page.getByRole('button', { name: 'Practise', exact: true });
  await expect(practise).toBeEnabled();
  await expect(practise).toHaveAccessibleDescription(
    '20 facts from all three tables',
  );
});

test('toggling tiles updates the Practise caption', async ({ page }) => {
  await page.goto('./');
  const practise = page.getByRole('button', { name: 'Practise', exact: true });

  await page.getByRole('button', { name: '12s' }).click();
  await expect(
    page.getByRole('button', { name: '12s', pressed: false }),
  ).toBeVisible();
  await expect(practise).toHaveAccessibleDescription(
    '20 facts from the 6s and 8s',
  );

  await page.getByRole('button', { name: '8s' }).click();
  await expect(practise).toHaveAccessibleDescription('20 facts from the 6s');

  await page.getByRole('button', { name: '12s' }).click();
  await expect(practise).toHaveAccessibleDescription(
    '20 facts from the 6s and 12s',
  );
});

test('with no table on Practise is disabled with a prompt', async ({
  page,
}) => {
  await page.goto('./');
  for (const table of TILES) {
    await page.getByRole('button', { name: table }).click();
  }
  const practise = page.getByRole('button', { name: 'Practise', exact: true });
  await expect(practise).toBeDisabled();
  await expect(practise).toHaveAccessibleDescription(
    'Pick a table to practise',
  );

  await page.getByRole('button', { name: '8s' }).click();
  await expect(practise).toBeEnabled();
  await expect(practise).toHaveAccessibleDescription('20 facts from the 8s');
});

test('a changed selection is still there after a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '6s' }).click();
  await expect(
    page.getByRole('button', { name: '6s', pressed: false }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: '6s', pressed: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '8s', pressed: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '12s', pressed: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Practise', exact: true }),
  ).toHaveAccessibleDescription('20 facts from the 8s and 12s');
});

// A backup left by an earlier corrupt document, which the next one replaces.
const EARLIER_BACKUP = '{"version":1,"tables":"old"}';

const corruptDocuments: ReadonlyArray<readonly [string, string]> = [
  ['fails to parse', '{"version":1,'],
  ['fails the schema', '{"version":1,"tables":[6],"facts":{}}'],
  [
    'holds a level out of range',
    '{"version":1,"tables":[6],"facts":{"6x7":{"level":9,"fast":0,"slow":0,"missed":0}},"records":[]}',
  ],
  [
    'has an unknown version',
    '{"version":2,"tables":[6],"facts":{},"records":[]}',
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

    await expectAllTablesOn(page);
    await expect(
      page.getByRole('button', { name: 'Practise', exact: true }),
    ).toHaveAccessibleDescription('20 facts from all three tables');
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

  await page.getByRole('button', { name: '6s' }).click();
  await expect(
    page.getByRole('button', { name: '6s', pressed: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Practise', exact: true }),
  ).toHaveAccessibleDescription('20 facts from the 8s and 12s');
});

for (const [orientation, width, height] of [
  ['portrait', 820, 1180],
  ['landscape', 1180, 820],
] as const) {
  test(`the Start screen fits an iPad in ${orientation}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('./');

    const parts = [
      page.getByRole('heading', { level: 1, name: 'Times tables' }),
      page.getByRole('button', { name: '6s' }),
      page.getByRole('button', { name: '12s' }),
      page.getByRole('button', { name: 'Practise', exact: true }),
      page.getByText('20 facts from all three tables'),
      page.getByRole('button', { name: 'Speed run' }),
      page.getByText('all 33 facts, no best yet'),
    ];
    for (const part of parts) {
      await expect(part).toBeInViewport({ ratio: 1 });
    }
  });
}
