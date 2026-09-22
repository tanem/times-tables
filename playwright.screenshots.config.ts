import { defineConfig, devices } from '@playwright/test';

// The config `npm run screenshots` runs: one WebKit project at an iPad's
// portrait viewport, rendered at two pixels per point, against the built app
// served by vite preview. It is separate from playwright.config.ts because
// the screenshots are not a check; docs/development.md says why.

const baseURL = 'http://localhost:4173/times-tables/';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'screenshots.ts',
  reporter: 'list',
  use: {
    ...devices['Desktop Safari'],
    baseURL,
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    // Fixes the date wording on the Parent view to the same day on every
    // machine, as the tests do.
    timezoneId: 'UTC',
  },
  // vite preview serves dist, so the script builds first.
  webServer: {
    command: 'npm run preview',
    url: baseURL,
    reuseExistingServer: true,
  },
});
