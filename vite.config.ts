import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/times-tables/',
  test: {
    // The model tests only; the browser boundary is covered by Playwright
    // under e2e/.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
