# times-tables

A small web app for practising the 6, 8 and 12 times tables against a 3-second limit. Built for an iPad, hosted on GitHub Pages.

## Development

Node 24, as pinned in `.nvmrc`. Install the dependencies with `npm ci`, then install the browsers the end-to-end tests run in with `npx playwright install chromium webkit`.

`npm run check` runs every check, in order: the Prettier format check, `tsc --noEmit`, the Vitest model tests, the production build, and the Playwright tests against the built app served by `vite preview`. `npm run dev` starts the Vite dev server.

## Deployment

Pushes to `main` that pass the checks deploy to GitHub Pages at https://tanem.github.io/times-tables/.
