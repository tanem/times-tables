import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const configDir = dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./package.json', import.meta.url)),
    'utf8',
  ),
);

// The build's short commit: read from git, quietly, when the build runs in
// a checkout, falling back to "unknown" so a build never fails for lack of
// one.
function shortCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: configDir,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
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
