# times-tables

A small web app for practising the 6, 8 and 12 times tables against a 3-second limit. Built for an iPad, hosted on GitHub Pages.

## Installing on an iPad

Open https://tanem.github.io/times-tables/ in Safari, tap the Share button, choose Add to Home Screen, and tap Add. Safari is the only browser that can do this; another browser on iOS cannot install the app.

Open the app once from its icon while the iPad is online. The installed app has its own storage, separate from the Safari tab it was added from, so its first launch needs a network to save itself. After that it works with no network at all.

Updates arrive on their own: when the app is opened with a network it fetches the new version in the background and applies it on the Start screen, never in the middle of a drill or a speed run. The version and build a launch is running are shown at the bottom of the Parent view, reached from "For parents" on the Start screen, which is the way to tell an update has landed.

The progress lives only inside the installed app on that iPad. Deleting the icon erases it, moving to a new iPad does not carry it over, and there is no export.

## Development

Node 24, as pinned in `.nvmrc`. Install the dependencies with `npm ci`, then install the browsers the end-to-end tests run in with `npx playwright install chromium webkit`.

`npm run check` runs every check, in order: the Prettier format check, `tsc --noEmit`, the Vitest tests, the production build, and the Playwright tests against the built app served by `vite preview`. `npm run dev` starts the Vite dev server.

`npm run icons` regenerates the icons in `public/` from `public/icon.svg`, following `pwa-assets.config.ts`. The generated files are committed, so the script is only run when the source drawing changes.

The end-to-end tests cover the manifest, the precache list and an offline reload, but they run in a desktop browser. A deploy that touches the manifest or the service worker also needs the manual check on an iPad: add the app to the home screen from Safari, then launch it from the icon with the network off and confirm it opens.

## Deployment

Pushes to `main` that pass the checks deploy to GitHub Pages at https://tanem.github.io/times-tables/.
