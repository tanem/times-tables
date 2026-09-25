# Development

Node 24, as pinned in `.nvmrc`. Install the dependencies with `npm ci`, then install the browsers the end-to-end tests run in with `npx playwright install chromium webkit`. Installing also sets up a `commit-msg` hook that checks each commit message against Conventional Commits.

`npm run check` runs every check, in order: the Prettier format check, ESLint, `tsc --noEmit`, the Vitest tests, the production build, and the Playwright tests against the built app served by `vite preview`. `npm run dev` starts the Vite dev server. CI runs the same checks on every pull request and on every push to `main`. A failed Playwright run uploads its HTML report and traces as a workflow artifact.

`npm run icons` regenerates the icons in `public/` from `public/icon.svg`, following `pwa-assets.config.ts`. The generated files are committed, so the script is only run when the source drawing changes.

The end-to-end tests cover the manifest, the precache list and an offline reload, but they run in a desktop browser. A deploy that touches the manifest or the service worker also needs the manual check on an iPad: add the app to the home screen from Safari, then launch it from the icon with the network off and confirm it opens.

## Screenshots

`npm run screenshots` builds the app and runs `e2e/screenshots.ts` under `playwright.screenshots.config.ts`: WebKit at an iPad's portrait viewport of 820 × 1180 points at two pixels per point, against the built app served by `vite preview`. It writes the six images the README shows to `docs/screenshots/`: the Start screen, the Shop, the card, the feedback with the gem an answer paid, the end screen and the Parent view.

The script seeds an invented learner under the end-to-end fixtures' fixed clock and seed, so nothing in the images comes from a real learner. It is not part of `npm run check`: WebKit renders differently across platforms, so a pixel diff would flake. Regenerate the images by hand when the UI changes and commit them, as with the icons.

## Deployment

Pushes to `main` that pass the checks deploy to GitHub Pages at https://tanem.github.io/times-tables/.

## Dependency updates

Renovate opens dependency update pull requests, including majors, and merges them with a merge commit once the `check` job passes, so that job, which ends with the Playwright suite, is the only gate. Its first pull request pins every dependency to an exact version, and it also pins the workflow's actions to commit digests. It takes no release until it is 3 days old, except a fix for a vulnerability alert, which it takes at once. Its pull requests carry the `internal` label, and the dependency dashboard issue lists what is pending. TypeScript is capped below version 7 until typescript-eslint supports it.

## Working with agents

The instructions agents follow in this repo are in [`docs/agents/`](agents/). The work is planned on a map issue, the open issue labelled `wayfinder:map`, with the tickets as its sub-issues; at the time of writing that is [#36](https://github.com/tanem/times-tables/issues/36).
