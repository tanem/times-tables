# Deploying a PWA to a GitHub Pages project site

Research for issue #3. Sources were read on 2026-09-17; every claim links to the primary source that owns it. Version numbers were checked against the GitHub Releases API and the npm registry on that date rather than taken from documentation, because GitHub's own published examples lag the current releases.

The deployment target assumed throughout is a project site at `https://<user>.github.io/times-tables/`. The subpath is the whole problem: nothing about a PWA served from an origin root carries over unchanged.

## Summary

A project site serves the app from `/times-tables/`, not `/`. Four things have to agree on that prefix: the manifest's `start_url` and `scope`, the service worker's location and registration scope, the URLs inside the precache list, and every asset reference in the HTML. Writing all of them as relative URLs makes them agree automatically, because manifest members resolve against the manifest's URL and service worker precache entries resolve against the worker's URL. Hard-coded root-absolute URLs (`/`, `/sw.js`, `/manifest.webmanifest`) are the characteristic failure, and they fail silently: the app still loads, but it installs with the wrong scope or never updates.

Deployment itself is the artifact-based GitHub Actions flow (`configure-pages` to `upload-pages-artifact` to `deploy-pages`), not a `gh-pages` branch. Cache-busting rests on content-hashed filenames for JS and CSS plus a service worker script that changes bytes on every deploy.

## Manifest `start_url` and `scope`

Both members resolve against the **manifest's** URL, not the document's. The [Web App Manifest spec](https://w3c.github.io/manifest/) states it for `start_url` ("Let start URL be the result of parsing json\["start_url"\], using manifest URL as the base URL") and again for `scope`. [MDN's `start_url` page](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/start_url) (last modified 2026-08-31) and [`scope` page](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/scope) (2025-06-23) agree. The current TR snapshot is the [W3C Working Draft of 13 August 2026](https://www.w3.org/TR/appmanifest/).

Defaults, per the spec and MDN: an omitted or invalid `start_url` falls back to the URL of the document that linked the manifest; an omitted `scope` defaults to `start_url` with its filename, query and fragment removed.

Two details decide the correct values under a subpath.

The scope test is a **string prefix test, not a path-segment test**. From the spec: "The URL string matching in this algorithm is prefix-based rather than path-structural (e.g. a target URL string `/prefix-of/resource.html` will match an app with scope `/prefix`, even though the path segment name is not an exact match). This is intentional for consistency with Service Workers. To avoid unexpected behavior, use a scope ending in a `/`." The trailing slash is not cosmetic.

If `start_url` falls outside `scope`, the `scope` member is **discarded**, not corrected. The algorithm returns early, leaving the default scope derived from `start_url`. So a mismatch does not produce an error — it produces a silently different scope.

The spec's general advice to set `scope` to `"/"` is written for origin-root apps and is wrong here. Relative values are the robust choice, because the same build then works at `/times-tables/`, at a renamed repository path, and at `http://localhost:8080/` with no edits:

```json
{
  "id": "./",
  "name": "Times Tables",
  "short_name": "Tables",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Link it with a relative `href` — `<link rel="manifest" href="manifest.webmanifest">`. A root-absolute `/manifest.webmanifest` returns 404 on a project site. `crossorigin` is only needed when the manifest fetch requires credentials ([MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)); for a public same-origin manifest, omit it.

Installability minimums differ by engine. Chromium's [documented install criteria](https://web.dev/articles/install-criteria) require HTTPS, `name` or `short_name`, `start_url`, a `display` value of `fullscreen`/`standalone`/`minimal-ui`/`window-controls-overlay`, and icons including 192px and 512px. [MDN notes](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) that a service worker is not itself an installability requirement. WebKit has gone the other way: per [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) (2025-09-15), "By default, every website added to the Home Screen opens as a web app… Simply put, there are now zero requirements for 'installability' in Safari." The manifest still supplies the icons, name, display mode and scope.

Apple's legacy tags remain worth including for pre-iOS 26 devices: `<meta name="apple-mobile-web-app-capable" content="yes">` and an explicit `<link rel="apple-touch-icon" href="icons/apple-touch-icon-180.png">` ([Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)). Do not rely on the conventional root `/apple-touch-icon.png` — under a subpath it does not exist.

Scope matters more on iOS than elsewhere. Per Apple's WWDC23 session [What's new in web apps](https://developer.apple.com/videos/play/wwdc2023/10120/): "Any links within the scope will stay within the web app and any links outside the scope will open in the default browser… The default scope is the host of the webpage used to create the web app." On a shared host like `<user>.github.io`, defaulting to the host means every other project site on that host counts as in scope. An explicit `scope` fixes it.

## Service worker registration and scope

The default scope of a registration is the directory containing the script. [MDN's `register()` page](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register) (2026-06-10): "The default `scope` for a service worker registration is the directory where the service worker script is located (resolving `./` against `scriptURL`)."

A worker at `/times-tables/sw.js` therefore cannot control the origin root. The [Service Workers spec](https://w3c.github.io/ServiceWorker/) (Editor's Draft, 12 August 2026) calls this the path restriction: "a service worker script at `https://www.example.com/~bob/sw.js` can be registered for the scope url `https://www.example.com/~bob/` but not for the scope `https://www.example.com/`… This provides some protection for sites that host multiple-user content in separated directories on the same origin." Attempting a broader scope rejects with a `SecurityError`.

The restriction can only be lifted with a `Service-Worker-Allowed` response header on the script ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Service-Worker-Allowed)). GitHub Pages documents no mechanism for setting custom response headers, so that route is closed — which is fine, because origin-root scope is not wanted. Placing `sw.js` at `/times-tables/sw.js` gives exactly the right default scope.

The registration call needs one piece of care. Per the spec's `register()` steps, both `scriptURL` and `options.scope` are parsed against the **calling document's** URL. A bare `"sw.js"` registered from a nested page such as `/times-tables/practice/` resolves to `/times-tables/practice/sw.js` and 404s. Resolving against `document.baseURI` avoids that:

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Resolve against the document base so the same build works at
    // https://<user>.github.io/times-tables/ and at http://localhost:8080/.
    // A hard-coded "/sw.js" points at the origin root, not the repo subpath.
    const swUrl = new URL("sw.js", document.baseURI);
    navigator.serviceWorker
      .register(swUrl, { scope: "./", updateViaCache: "none" })
      .then((reg) => console.log("SW scope:", reg.scope)) // .../times-tables/
      .catch((err) => console.error("SW registration failed:", err));
  });
}
```

`scope: "./"` is redundant with the default but documents the intent. `updateViaCache: "none"` is covered below.

## Cache-busting on redeploy

An update is detected by a **byte comparison of the worker script**. The spec's update algorithm sets `hasUpdatedResources` when "newestWorker's script resource map\[url\]'s body is not byte-for-byte identical with response's body". [web.dev's service worker lifecycle article](https://web.dev/articles/service-worker-lifecycle) puts it plainly: "Your service worker is considered updated if it's byte-different to the one the browser already has." Checks happen on navigation to an in-scope page, and on functional events unless a check already happened in the previous 24 hours.

That 24-hour figure is normative: a registration is "stale" when the time since its last update check exceeds 86400 seconds, at which point the script fetch bypasses the HTTP cache. Separately, [Chrome has ignored caching headers on the worker script since Chrome 68](https://developer.chrome.com/blog/fresher-sw): "HTTP requests that check for updates to the service worker script will no longer be fulfilled by the HTTP cache by default." Setting `updateViaCache: "none"` removes the question for the main script and its imports in every engine.

The lifecycle is install, then wait, then activate. Per web.dev: "After it's successfully installed, the updated service worker delays activating until the existing service worker is no longer controlling clients. This state is called 'waiting.'" `skipWaiting()` activates immediately; `clients.claim()` takes control of already-open pages. web.dev attaches a caution to the first: "`skipWaiting()` means that your new service worker is likely controlling pages that were loaded with an older version… If this might break things, don't use `skipWaiting()`." For an app where a reload is harmless the tradeoff is easy; where it is not, an "update available, reload?" prompt driven by `updatefound`/`statechange` is the safer pattern.

Old caches are deleted in `activate`. [MDN's caching guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching) (2025-06-12): "when this event fires, the service worker can be sure that no previous versions of the service worker are running, so old cached data is no longer needed."

```js
const CACHE_NAME = "times-tables-v3"; // bump on every deploy
const PRECACHE = [
  "./", "./index.html", "./app.a1b2c3.js", "./style.d4e5f6.css",
  "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
```

Every precache entry is relative, so it resolves against the worker's URL and nothing hard-codes the repository name.

The rule that makes this work: **hash JS and CSS filenames; never hash `sw.js` or `index.html`.** Hashed asset names change the precache list, which changes the bytes of `sw.js`, which is what triggers the update. Without hashing, a version constant has to be bumped by hand or the script stays byte-identical and no update ever fires. [Workbox's precaching docs](https://developer.chrome.com/docs/workbox/modules/workbox-precaching) describe the same split: "URLs that already include versioning information (like a content hash) are used as cache keys without any further modification", while unversioned URLs get a content-hash query parameter appended.

web.dev names the trap directly, and it is the one that strands users permanently: "you may consider giving each version of your service worker a unique URL. **Don't do this!**… If you do the above, the user never gets `sw-v2.js`, because `sw-v1.js` is serving the old version of `index.html` from its cache. You've put yourself in a position where you need to update your service worker in order to update your service worker."

GitHub does not document the cache headers it serves from Pages — this was checked against [About GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages) and the Pages troubleshooting pages, and nothing there covers `Cache-Control` or header configuration. Observed directly with `curl` against a live project site on 2026-09-17: `cache-control: max-age=600` with an `ETag`, fronted by Fastly. That is an observation, not a contract. Ten minutes sits well below the 86400-second staleness cap, so the HTTP cache is not itself a stale-forever hazard; the practical expectation is that an update lands within roughly ten minutes plus one in-scope navigation, not instantly.

## Recommended GitHub Actions workflow

Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. GitHub's guidance is conditional rather than blanket — from [the publishing-source reusable](https://github.com/github/docs/blob/main/data/reusables/pages/pages-about-publishing-source.md): "If you want to use a build process other than Jekyll or you do not want a dedicated branch to hold your compiled static files, we recommend that you write a GitHub Actions workflow to publish your site." A built static PWA is exactly that case.

The [custom workflows doc](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) states the requirements: at minimum `pages: write` and `id-token: write` permissions; `needs` set to the build job's id; an `environment` (default `github-pages`); and `url:` to surface the deployed address. The two permissions are distinct — per the [`deploy-pages` README](https://github.com/actions/deploy-pages#oidc), "The pages permission relates to the `GITHUB_TOKEN`… The id-token permission is necessary to request the OIDC JWT token", and the OIDC claim about the ref is what lets Pages enforce branch protection.

Current major versions, confirmed against the GitHub Releases API on 2026-09-17:

| Action | Latest release | Published |
| --- | --- | --- |
| `actions/checkout` | v7.0.1 | 2026-07-20 |
| `actions/setup-node` | v7.0.0 | 2026-07-14 |
| `actions/configure-pages` | v6.0.0 | 2026-03-25 |
| `actions/upload-pages-artifact` | v5.0.0 | 2026-04-10 |
| `actions/deploy-pages` | v5.0.1 | 2026-09-01 |

GitHub's own published examples lag these and disagree with each other — the [starter workflow templates](https://github.com/actions/starter-workflows/blob/main/pages/static.yml) offered in the Pages settings UI still pin `checkout@v4`, `configure-pages@v5` and `upload-pages-artifact@v3`, while the docs show a different mix again. Copying the template from the settings UI yields an out-of-date workflow.

```yaml
name: Deploy static site to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

# Allow GITHUB_TOKEN to deploy to GitHub Pages.
permissions:
  contents: read
  pages: write
  id-token: write

# One deployment at a time; do not cancel a deploy already in flight.
concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7
      - name: Set up Node
        uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm
      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v6
      - name: Install dependencies
        run: npm ci
      - name: Build
        # base_path is "/times-tables" for a project site, "" for a user site or custom domain.
        run: npm run build -- --base="${{ steps.pages.outputs.base_path }}/"
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

`actions/configure-pages` is the piece that earns its place on a project site. Its [`action.yml`](https://github.com/actions/configure-pages/blob/main/action.yml) exposes a `base_path` output described as "GitHub Pages site full base path. Examples: `/my-repo` or `""`" — `/times-tables` here, and an empty string if a custom domain or user site is adopted later. Reading the subpath from that output rather than hard-coding it means the same workflow keeps working through such a move. Its `static_site_generator` input only covers Next, Gatsby, Nuxt and SvelteKit and is not needed for Vite.

`actions/upload-pages-artifact` tars the directory given by `path` (default `_site/`, so it must be set for a `dist` build) and uploads it as an artifact named `github-pages`. Its [README](https://github.com/actions/upload-pages-artifact#artifact-validation) states the limits: under 1GB officially supported, symlinks and hard links disallowed in the tar (the action dereferences them for you). `actions/deploy-pages` consumes it and outputs `page_url`.

Two constraints are easy to trip over.

`.nojekyll` is **not needed** on the Actions path — Jekyll only runs when publishing from a source branch. Worse, adding one may not survive: since `upload-pages-artifact@v4`, dotfiles are excluded from the artifact by default, so a `.nojekyll` or a `.well-known/` directory in `dist/` is silently dropped unless `include-hidden-files: true` is set (available in v5).

GitHub Pages [limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): sites no larger than 1GB, deployments time out after 10 minutes, soft bandwidth limit of 100GB per month. The soft limit of 10 builds per hour does not apply to custom Actions workflows.

A custom domain is not configured from the workflow. Per [the publishing-source doc](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), "A `CNAME` file in your repository file does not automatically add or remove a custom domain. Instead, you must configure the custom domain through your repository settings or through the API."

## What changes with Vite

Vite's [`base` option](https://vite.dev/config/shared-options.html#base) handles the subpath for everything inside the build graph. From the [build guide](https://vite.dev/guide/build.html#public-base-path): "JS-imported asset URLs, CSS `url()` references, and asset references in your `.html` files are all automatically adjusted to respect this option during build." The [static deploy guide](https://vite.dev/guide/static-deploy.html#github-pages) states the project-site case directly: "If you are deploying to `https://<USERNAME>.github.io/<REPO>/`… then set `base` to `'/<REPO>/'`." Current Vite is 8.3.0, and the docs' own GitHub Pages example uses the same `configure-pages` to `upload-pages-artifact` to `deploy-pages` flow, SHA-pinned to the v7/v6/v5/v5 majors above.

Three things `base` does **not** do, and they are the ones that matter for a PWA.

Files in `public/` are copied "as-is without transform" ([publicDir](https://vite.dev/config/shared-options.html#publicdir)). A hand-written `manifest.webmanifest` in `public/` is therefore emitted byte-for-byte: `base` will not rewrite `start_url`, `scope` or icon `src` values inside it. A manifest saying `"start_url": "/"` ships broken. The `<link rel="manifest">` in `index.html` **is** rewritten, because that is an HTML asset reference — so the manifest is found, but its contents are wrong. That combination is exactly the silent failure described earlier.

Hashing applies to the build graph only. Imported assets become content-addressed names like `/assets/img.2d8efhg.png` ([Vite assets guide](https://vite.dev/guide/assets.html#importing-asset-as-url)); `index.html` and everything in `public/` keep stable names by design. This is the right shape for the cache-busting rule above, but it means `index.html` and the manifest must not be cached immutably — not a concern on Pages, which serves `max-age=600` and offers no header control either way.

Runtime base access needs `import.meta.env.BASE_URL`, which is "statically replaced during build so it must appear exactly as-is (i.e. `import.meta.env['BASE_URL']` won't work)" ([Vite](https://vite.dev/guide/build.html#public-base-path)).

`vite-plugin-pwa` (currently 1.3.0) closes the manifest gap by deriving the PWA fields from `base`. Its docs state it for `scope` — "the `vite-plugin-pwa` plugin will use the `Vite` base option to configure it" ([minimal requirements](https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements.html#web-app-manifest)) — and the [v1.3.0 source](https://github.com/vite-pwa/vite-plugin-pwa/blob/v1.3.0/src/options.ts) shows the same base path feeding the generated manifest's `start_url` and `scope`, the emitted `sw.js` URL, the registration's `scope` option, and the injected manifest link tag. With `base: '/times-tables/'` set, all of them line up without further configuration. Note the plugin generates root-absolute values (`/times-tables/`) rather than the relative `./` recommended above for a hand-written manifest; both are correct, but the generated form is tied to the configured base.

```js
// vite.config.js
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/times-tables/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        // start_url and scope are filled in from `base`.
        name: 'Times Tables',
        short_name: 'Tables',
        theme_color: '#ffffff', // must match <meta name="theme-color"> in index.html
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
})
```

Two plugin options are worth deciding deliberately. `registerType` defaults to `prompt`; `autoUpdate` forces `skipWaiting` and `clientsClaim` and reloads open tabs, which the [docs warn against](https://vite-pwa-org.netlify.app/guide/auto-update.html) where a form might be mid-entry — and they add that "Changing the behavior of the service worker from `autoUpdate` to `prompt` can be a pain", so it is worth settling before the first deploy. `globPatterns` defaults to `**/*.{js,css,html}`, and the [docs stress](https://vite-pwa-org.netlify.app/guide/static-assets.html#globpatterns) that overriding it means listing all patterns, including `js`, `css` and `html`, or the worker fails with `non-precached-url index.html`. The default `maximumFileSizeToCacheInBytes` is 2 MiB and an oversized asset is a build error.

The plugin's `navigateFallback` defaults to the bare string `'index.html'`, which resolves against the worker's own location — `/times-tables/sw.js`, hence `/times-tables/index.html`. It works under a subpath without configuration, which is also a reason not to "fix" it by hand.

There is no GitHub Pages page in the plugin's deployment docs, and no primary source covers Pages and `vite-plugin-pwa` together. The plugin's [deployment checklist](https://vite-pwa-org.netlify.app/deployment/) asks for restrictive `Cache-Control` on `/`, `/sw.js`, `/index.html` and `/manifest.webmanifest`; on Pages that is not configurable, and the observed `max-age=600` happens to satisfy it.

The delta against plain static files, stated concretely: without a bundler, the subpath must be hard-coded or kept document-relative in every script tag, link, fetch and manifest field by hand; cache-busting means hand-maintained version query strings or filenames; and the precache list in `sw.js` must be edited on every asset change, with a missed entry producing a permanently stale file. With Vite, `base` handles the first, and content hashing plus a generated precache manifest handle the other two. Both of the hand-maintained failures are silent ones, which is the main argument for the build step.

## iPad and WebKit notes

Service workers and the Cache API have been available in WebKit since iOS 11.3 ([Workers at Your Service](https://webkit.org/blog/8090/workers-at-your-service/)). Since Safari 16.4, third-party browsers on iOS can offer Add to Home Screen through the share menu ([WebKit Features in Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)), which [MDN corroborates](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

The storage rule that matters for an offline app: WebKit's [seven-day cap on script-writable storage](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) covers "Service Worker registrations and cache" and fires "after seven days of Safari use without user interaction on the site" — but "Web applications added to the home screen are not part of Safari and thus have their own counter of days of use… We do not expect the first-party in such a web application to have its website data deleted." An app used only in a browser tab can therefore lose its caches after a week of disuse, while the installed home-screen app is effectively exempt. That is a concrete argument for installing rather than bookmarking.

[WebKit's 2023 storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) confirms a standalone home-screen web app gets the same origin and overall quota as it would in the browser, and that `StorageManager.persist()` is granted "based on heuristics like whether the website is opened as a Home Screen Web App" — so calling `navigator.storage.persist()` from the installed app is worthwhile.

An installed home-screen app does not run inside the third-party browser; it runs in the system web app runtime, so offline behaviour after install is governed by WebKit rather than by the browser used to install it. Testing should therefore target the installed app, not only the browser tab. No Apple primary source was found stating the service worker availability rules for third-party iOS browser tabs explicitly; that point is flagged as unverified.

## Open questions

- GitHub does not publish its Pages cache headers or Fastly purge timing. The `max-age=600` above is an observation from 2026-09-17 and could change.
- Service worker availability in a third-party iOS browser tab (as opposed to the installed home-screen app) is not covered by any Apple primary source found.
- GitHub Pages performs no SPA rewrite, so a cold deep link to a client-side route 404s before the worker is installed. The usual workaround is a `404.html` copy of `index.html`; this is not documented on vite.dev or in the Pages docs, so it is noted as a known constraint rather than a sourced claim.
