import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/times-tables/',
  test: {
    // The unit tests under src/; the browser boundary is covered by
    // Playwright under e2e/.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
