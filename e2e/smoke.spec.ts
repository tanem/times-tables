import { expect, test } from './fixtures';
import { startHeading } from './helpers';

test('the app opens on a page named Times tables', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Times tables');
  await expect(startHeading(page)).toBeVisible();
});
