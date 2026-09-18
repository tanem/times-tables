import { expect, test } from './fixtures';

test('the app opens on a page named Times tables', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Times tables');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Times tables' }),
  ).toBeVisible();
});
