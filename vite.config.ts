import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./package.json', import.meta.url)),
    'utf8',
  ),
);

// The build's short commit: read from git when the build runs in a
// checkout, falling back to the CI-provided SHA, then to "unknown" so a
// build never fails for lack of either.
function shortCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    const sha = process.env.GITHUB_SHA;
    return sha ? sha.slice(0, 7) : 'unknown';
  }
}

export default defineConfig({
  base: '/times-tables/',
  // Injected as literal strings and read in src/build.ts alone; declared as
  // globals in src/env.d.ts.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(shortCommit()),
  },
  test: {
    // The unit tests under src/; the browser boundary is covered by
    // Playwright under e2e/.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
