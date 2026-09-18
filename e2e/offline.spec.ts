// The service worker's own tests. These import Playwright's test directly
// rather than the fixtures in fixtures.ts: those install a paused clock in
// the page, and workbox-window measures registration with the clock it
// finds, so a worker would never be reported as ready.
import { expect, test } from '@playwright/test';
import { startHeading } from './helpers';

// The URLs the worker precaches, read out of the generated sw.js.
function precachedUrls(source: string): string[] {
  return [...source.matchAll(/url:"([^"]+)"/g)].map((match) => match[1] ?? '');
}

// Chromium alone: Playwright routes service worker network traffic in
// Chromium only, and in WebKit an offline reload of a page the worker
// controls fails with "WebKit encountered an internal error" every time (run
// five times with --repeat-each 5). The other two tests here read the served
// files and pass in both browsers.
test('the app opens and works with no network once the worker is active', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'the worker goes offline in Chromium');
  await page.goto('./');
  await expect(startHeading(page)).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}));

  await context.setOffline(true);
  await page.reload();

  // The Start screen offline proves the index came from the precache, and a
  // card proves the hashed JS and CSS did too.
  await expect(startHeading(page)).toBeVisible();
  await page.getByRole('button', { name: 'Practise', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('×');

  // Both self-hosted fonts came from the precache as well.
  const families = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family);
  });
  expect(families).toContain('Fredoka');
  expect(families).toContain('Nunito');
});

test('the built app serves a manifest that installs to the home screen', async ({
  page,
  request,
}) => {
  await page.goto('./');

  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  if (!href) throw new Error('no manifest link');
  const manifest = await (await request.get(href)).json();

  expect(manifest.name).toBe('Times tables');
  expect(manifest.display).toBe('standalone');
  // Relative, so they resolve against the manifest's own URL under the base.
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  // iOS decides the orientation itself; the manifest does not ask for one.
  expect(manifest).not.toHaveProperty('orientation');

  const icon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute('href');
  if (!icon) throw new Error('no apple-touch-icon link');
  const response = await request.get(icon);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
});

test('the worker precaches everything the app needs offline', async ({
  page,
  request,
}) => {
  await page.goto('./');

  // The hashed names as the page itself asks for them, so that no hash is
  // written down here.
  const script = await page.locator('script[src]').first().getAttribute('src');
  const stylesheet = await page
    .locator('link[rel=stylesheet]')
    .first()
    .getAttribute('href');
  if (!script || !stylesheet) throw new Error('no hashed assets on the page');

  const urls = precachedUrls(await (await request.get('./sw.js')).text());

  expect(urls).toContain('index.html');
  expect(urls).toContain('manifest.webmanifest');
  expect(urls).toContain(script.replace(/^.*\/times-tables\//, ''));
  expect(urls).toContain(stylesheet.replace(/^.*\/times-tables\//, ''));
  // The fonts and the chunk the registration imports, matched by pattern
  // because each carries a build hash.
  for (const pattern of [
    /^assets\/fredoka-latin-600-normal-[\w-]+\.woff2$/,
    /^assets\/nunito-latin-400-normal-[\w-]+\.woff2$/,
    /^assets\/workbox-window\.prod\.es5-[\w-]+\.js$/,
  ]) {
    expect(urls.some((url) => pattern.test(url))).toBe(true);
  }
});
