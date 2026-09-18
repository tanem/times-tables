import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
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

// The app's paper colour, as src/style.css sets --paper. It is the colour
// iOS paints round the app before the page draws.
const PAPER = '#fffaf0';

export default defineConfig({
  base: '/times-tables/',
  // Injected as literal strings and read in src/build.ts alone; declared as
  // globals in src/env.d.ts.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT__: JSON.stringify(shortCommit()),
  },
  plugins: [
    VitePWA({
      // prompt, per docs/adr/0001: src/main.ts decides when a waiting worker
      // is applied. skipWaiting and clientsClaim stay off for that reason.
      registerType: 'prompt',
      // src/main.ts imports virtual:pwa-register, so nothing is injected
      // into index.html; a second registration would fight the first.
      injectRegister: null,
      // The manifest's own URL sits under the base, so a relative start URL
      // and scope resolve to the app wherever it is served from.
      manifest: {
        name: 'Times tables',
        short_name: 'Times tables',
        description: 'Practise the 6, 8 and 12 times tables.',
        display: 'standalone',
        start_url: './',
        scope: './',
        background_color: PAPER,
        theme_color: PAPER,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything the app needs offline: the index, the hashed JS and
        // CSS, the self-hosted fonts and the icons.
        globPatterns: ['**/*.{html,js,css,woff2,png,ico,svg}'],
      },
    }),
  ],
  test: {
    // The unit tests under src/; the browser boundary is covered by
    // Playwright under e2e/.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
