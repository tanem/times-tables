# Home-screen web apps in Brave on iPad

Researched 17 September 2026. Every claim below is cited to a primary source with its publication date. Where no primary source exists, that is stated rather than filled in from memory.

## Short answer

Brave on iPadOS cannot add a site to the home screen. Apple has allowed third-party browsers to do this since iOS/iPadOS 16.4 (March 2023), but Brave has chosen not to implement it, because a home-screen web app added from a third-party browser is launched by the system in WebKit rather than by the browser that added it, which would drop Brave's ad blocking and privacy protections. The practical consequence for this app: install from Safari, not from Brave.

A site installed from Safari on iPadOS 26 or later opens as a standalone web app, runs offline through a service worker, and is exempt from WebKit's seven-day deletion of script-writable storage, so `localStorage` and IndexedDB survive between sessions and across days. A site merely opened as a Brave tab is subject to that seven-day sweep, and its offline support is not confirmed by any primary source.

## 1. Installability in Brave

Brave for iOS and iPadOS has no "Add to Home Screen" item in its share sheet or menu, as of Brave iOS 1.94 (App Store listing, released 8 September 2026; 1.95.x was in release QA on 16 September 2026 per brave/brave-browser issues #59082-#59084).

The open tracking issue is [brave/brave-browser#42480, "'Add to Home Screen'/PWA feature for Brave iOS"](https://github.com/brave/brave-browser/issues/42480), created 23 November 2024, still open as of 26 January 2026, with no maintainer comment. Its predecessor, [brave/brave-ios#3385](https://github.com/brave/brave-ios/issues/3385) (opened 8 March 2021, closed; repo archived May 2024), was closed with the maintainer reasoning "We're blocked on this at the moment and can't implement as this is not exposed outside of Safari" — reasoning that Apple made obsolete in iOS 16.4.

The current and authoritative Brave statement is a reply by Brave iOS engineer Kyle Hickinson in the Brave Community thread ["'Add to Home Screen' as PWA / Standalone Web App on iOS"](https://community.brave.app/t/add-to-home-screen-as-pwa-standalone-web-app-on-ios/650126), 12 March 2026:

> Just to shed some light on the situation: We initially did want to support adding PWAs to your home screen from Brave, however the main blocker here is that fullscreen PWAs that are added from third-party browsers will launch in Safari anyways (they launch without Safari chrome like when you add fullscreen PWAs from Safari, but its still Safari, not Brave loading the page.) which means losing adblock and other Brave privacy protections.

This is confirmed at the source level. Apple's requirement for the system Add to Home Screen action to appear in a third-party browser's share sheet is that a `WKWebView` is present in the `UIActivityViewController` activity items ([WebKit, "Web Push for Web Apps on iOS and iPadOS", 16 February 2023](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Brave's [`ShareExtensionHelper.swift`](https://github.com/brave/brave-core/blob/master/ios/brave-ios/Sources/Brave/Frontend/Share/ShareExtensionHelper.swift) builds its activity items from `UIPrintInfo`, `TabPrintPageRenderer` and a URL provider only, with no web view. A repository-wide search of brave/brave-core for `AddToHomeScreen` returns only Android code and a vendored Rust binding, nothing under `ios/brave-ios/`.

Brave does hold the entitlement that would allow it: `com.apple.developer.web-browser` appears in every Brave iOS entitlements file, including [Release (AppStore).entitlements](https://github.com/brave/brave-core/blob/master/ios/brave-ios/App/iOS/Entitlements/Release%20(AppStore).entitlements). The gap is a product decision, not a platform limit.

Brave iOS also does not use an alternative browser engine anywhere, including the EU: there is no `BrowserEngineKit` usage in brave/brave-core, and none of Apple's alternative-engine entitlements (`com.apple.developer.web-browser-engine.rendering`, `.networking`, `.webcontent`) appear in Brave's entitlements. Brave iOS remains a WKWebView browser, which Brave states plainly in its [FAQ](https://brave.com/faq/): "every browser is Safari based (due to Apple's requirement that browser vendors must use WkWebView to build iOS mobile browsers)". Brave iOS release notes mentioning "Upgraded Chromium to 151.x" refer to shared Chromium code, not to the rendering engine.

## 2. What Safari installation produces

Since iPadOS 26, installation requires nothing of the site at all. [WebKit, "WebKit Features in Safari 26.0", 15 September 2025](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/):

> By default, every website added to the Home Screen opens as a web app. If the user prefers to add a bookmark for their browser, they can disable 'Open as Web App' when adding to Home Screen — even if the site is configured to be a web app.

> Simply put, there are now zero requirements for 'installability' in Safari.

A manifest is still worth shipping, because its members are honoured. The members with a primary source confirming iOS/iPadOS support are `display` (`standalone` or `fullscreen`; this is what removes browser chrome), `name`, `icons` (since iOS 15.4), `start_url`, `scope`, and `id`. MDN's browser-compat data agrees: `display`, `start_url` and `scope` since Safari on iOS 11.3, `icons` since 15.4, and manifest `orientation` unsupported on every Safari target. Note two precedence rules. An `apple-touch-icon` link in the document head takes precedence over manifest `icons` ([WebKit, 16 February 2023](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); the same note appears in MDN's compat data for `icons`). And `display: fullscreen` is listed as unsupported on Safari iOS in MDN's compat data, so `standalone` is the value to use.

Manifest `orientation`, `display_override`, `background_color` and `short_name` have no Apple or WebKit primary source stating support on iOS/iPadOS. `theme_color` is documented only for the Mac toolbar. `shortcuts` and `categories` are macOS-only (Safari 17.4, 5 March 2024).

The installed app is a separate task, not a Safari tab. [WebKit, 16 February 2023](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/): "when you tap on its icon, the web app opens like any other app on iOS or iPadOS instead of opening in a browser. You can see its app preview in the App Switcher, separate from Safari or any other browser."

Links outside the manifest `scope` open in Safari View Controller rather than inside the web app (Apple, WWDC23 session 10120, June 2023). For an offline single-page app this is unlikely to matter, but it argues for keeping every link relative and in-scope.

## 3. Offline via service worker

Service workers have been available to home-screen web apps since they shipped. [WebKit, "Workers at Your Service", updated 7 February 2018](https://webkit.org/blog/8090/workers-at-your-service/):

> A previous version of this post stated the Service Worker API is available in all applications using WKWebView. At this time it is only available in Safari, applications that use SFSafariViewController, and web applications saved to your home screen.

MDN's compat data puts Service Worker support at Safari on iOS 11.3 (March 2018) and Cache API / `CacheStorage` at the same version. So a home-screen web app installed from Safari can register a service worker, precache its shell, and run with no network.

Inside a plain Brave tab the answer is less certain and should be tested on the device rather than assumed. MDN models "WebView on iOS" as a distinct browser and records Service Worker support there as `false`, while recording Cache API support as 11.3 — so an iOS web view can use `caches` from a page but cannot register a service worker. That default is lifted by the browser entitlement, which Brave holds. Apple engineer `IhorShevchuk` in [Apple Developer Forums thread 745615](https://developer.apple.com/forums/thread/745615), February 2024:

> Service Workers are not available for WKWebView, except if your app has web browser entitlement.

No Brave statement, Brave issue, or runtime test confirms that service workers actually function in Brave iOS. There are no Brave GitHub issues about service workers on iOS at all. Treat "offline works in a Brave tab" as unverified until someone checks it on the iPad.

## 4. Storage persistence and eviction

The decisive rule is WebKit's Intelligent Tracking Prevention seven-day cap and its home-screen exemption. [WebKit, "Tracking Prevention in WebKit"](https://webkit.org/tracking-prevention/) (living policy document):

> ITP deletes all cookies created in JavaScript and all other script-writeable storage after 7 days of no user interaction with the website. The latter storage forms are: IndexedDB, LocalStorage, Media keys, SessionStorage, Service Worker registrations and cache

and, in the section "Home Screen Web Application Domain Exempt From ITP":

> The first-party domain of home screen web applications is exempt from ITP's 7-day cap on all script-writeable storage, i.e. ITP always skips that domain in its website data removal algorithm. In addition, the website data of home screen web applications is kept isolated from Safari and thus will not be affected by ITP's classification of tracking behavior in Safari.

The original announcement, [WebKit, "Full Third-Party Cookie Blocking and More", 24 March 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), says the same: "We do not expect the first-party in such a web application to have its website data deleted." No later WebKit post or Apple document walks this back; the WebKit feature posts for Safari 26.1, 26.2, 26.4, 26.6 and the Safari 27 beta contain no changes to home-screen web apps, the manifest, storage quota, eviction, or persistence.

So: installed from Safari, progress saved in `localStorage` or IndexedDB persists across sessions and across days, including gaps of more than a week. Opened as an ordinary Brave or Safari tab, it does not: after seven days of browser use without interaction with the site, the data is deleted. Daily practice would keep it alive in practice, but nothing guarantees that, and a school holiday would be enough to lose it.

Quota is not a constraint here. [WebKit, "Updates to Storage Policy", 10 August 2023](https://webkit.org/blog/14403/updates-to-storage-policy/), applying from iOS 17 / iPadOS 17:

> For a browser app, the origin quota is up to 60% of the total disk space.

> When a web app is running standalone (as Home Screen Web App on iOS or Web App added to dock on macOS), it has the same origin quota and overall quota as when it is opened in a browser app.

Overall quota is up to 80% of disk for browser apps and standalone web apps. `localStorage` is separately capped at around 5 MiB per origin (MDN, [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)), which is ample for a fact-level progress record but is a reason to prefer IndexedDB if the drill history ever grows.

Eviction under storage pressure is separate from the ITP sweep, and it is per origin and all-or-nothing: "the data of an origin will be deleted as a whole", in least-recently-used order, excluding origins with an active page or storage in persistent mode (same post).

`navigator.storage.persist()` works on iOS and iPadOS — MDN's compat data records `StorageManager.persist` and `persisted` from Safari on iOS 15.2 (December 2021) — and being a home-screen web app is the documented lever that makes the request succeed. From the same WebKit post:

> An origin can check whether storage is in persistent mode with StorageManager.persisted() and request to change the mode to be persistent with StorageManager.persist(). WebKit currently grants a request based on heuristics like whether the website is opened as a Home Screen Web App.

Calling `persist()` on startup is cheap and adds protection against pressure eviction on top of the ITP exemption. It should not be relied on as the only mechanism.

One consequence worth designing around: a home-screen web app has its own storage partition, separate from the browser's. Apple, WWDC23 session 10120 (June 2023): "Home Screen web apps have a standalone, app-like experience on iOS, with separate cookies and storage from the browser." Nothing is copied across at install time on iOS. Practice done in a Brave or Safari tab before installing will not appear inside the installed web app, and vice versa. The learner should install first, then practise only in the installed app.

## 5. Install steps a child can follow

These are Safari steps. There is no Brave equivalent. Apple's [iPad User Guide, "Turn a website into an app in Safari on iPad"](https://support.apple.com/guide/ipad/open-as-web-app-ipad8f1f7a29/ipados) gives the same sequence.

1. Open Safari (the blue compass icon), not Brave.
2. Go to the app's address.
3. Tap the Share button at the top of the screen — the square with an arrow pointing up out of it.
4. Scroll down the list and tap **Add to Home Screen**. On iPadOS 26 and later it may sit under **View More**.
5. Check that **Open as Web App** is switched on. It is on by default.
6. Tap **Add** in the top right.
7. Find the new icon on the Home Screen and tap it. It opens without any Safari bars around it.

From then on, always open it from that icon. Opening the same address in Brave or in a Safari tab is a different storage partition and will look like the progress is missing.

## 6. Safari fallback, and what the spec should say

The fallback is the other way round from the map's framing: Safari is the primary host and Brave is the fallback, because Brave cannot install and Brave-tab storage is not exempt from the seven-day sweep.

A bookmark added with **Open as Web App** switched off opens in whichever browser is set as default, which could be Brave. That is a plain bookmark, not a web app: no separate storage partition and no ITP exemption. Community reports in the Brave thread above describe this working; there is no Apple primary source confirming the routing, so treat it as secondary. It is not a substitute for installing.

For the app itself, the implications are:

- Ship a manifest with `name`, `display: standalone`, `start_url`, `scope`, and `icons`, plus an `apple-touch-icon` link (which wins over manifest icons on iOS).
- Ship a service worker that precaches the whole app, since the app is small and static. The app must work with the network off from the second launch.
- Save progress under one origin, and call `navigator.storage.persist()` at startup as a belt-and-braces measure.
- Include a visible way to export or reset progress, since all of an origin's storage is deleted together if it is ever evicted.
- State in any parent-facing instructions that the app is installed from Safari and used from the Home Screen icon.

## Version constraints

| Thing | Version | Date |
| --- | --- | --- |
| iPadOS current | 27 | 14 September 2026 |
| Every site installable as a web app, no manifest required | iPadOS 26 | 15 September 2025 |
| Manifest `icons` honoured | iOS/iPadOS 15.4 | March 2022 |
| Manifest `display`, `start_url`, `scope` honoured | iOS 11.3 | March 2018 |
| Service Worker, Cache API on Safari iOS | 11.3 | March 2018 |
| `StorageManager.persist()` on Safari iOS | 15.2 | December 2021 |
| Origin quota 60% of disk; home-screen web apps use the browser quota | iOS/iPadOS 17 | 10 August 2023 |
| Third-party browsers permitted to add home-screen web apps | iOS/iPadOS 16.4 | March 2023 |
| Brave iOS, no Add to Home Screen | 1.94 (App Store) | 8 September 2026 |

Minimum practical target: iPadOS 26 or later for the frictionless install. iPadOS 17 or later would still work but requires the manifest `display` value to trigger web-app mode, which the app will ship anyway.

## Gaps and caveats

- Whether service workers actually function inside a Brave iOS tab is unconfirmed. The entitlement says they should; no Brave statement or test confirms it. This needs an on-device check if the spec wants to promise anything about the Brave-tab path.
- `developer.apple.com/documentation/webkit/configuring-your-webpage-to-appear-in-web-apps` returns HTTP 404. There is no current Apple API documentation page on configuring web apps; the only Apple-hosted prose is the [archived Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) from 12 December 2016, which predates manifest support. The load-bearing current documentation is on webkit.org and in WWDC session transcripts.
- MDN does not mention the home-screen exemption from the seven-day sweep at all; its "Proactive eviction" section names only the server-set-cookie exemption. The exemption is cited above to webkit.org, which is the source that owns it.
- MDN's `localStorage` page states the data has "no expiration time", which is contradicted for WebKit by the ITP rule. MDN does not cross-reference the two.
- Apple's March 2024 statement reversing the removal of home-screen web apps in the EU no longer has a live URL; the EU support page has been rewritten (current text dated 18 August 2026). The contemporaneous WebKit bug [268643](https://bugs.webkit.org/show_bug.cgi?id=268643) documents the regression. This does not affect the conclusions here, since the feature was restored and Brave does not use an alternative engine in any region.
- Whether a home-screen web app participates in iPadOS windowing, Split View or Stage Manager is not documented by Apple either way.
- Add to Home Screen from a third-party browser is unavailable if the iPad is configured as a Shared iPad. Not relevant to a personal iPad, but worth knowing.

## Sources

- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ (15 September 2025)
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ (16 February 2023)
- https://webkit.org/blog/8090/workers-at-your-service/ (updated 7 February 2018)
- https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ (24 March 2020)
- https://webkit.org/blog/14403/updates-to-storage-policy/ (10 August 2023)
- https://webkit.org/blog/10882/app-bound-domains/ (26 June 2020)
- https://webkit.org/tracking-prevention/ (living document)
- https://support.apple.com/guide/ipad/open-as-web-app-ipad8f1f7a29/ipados
- https://developer.apple.com/videos/play/wwdc2023/10120/ (June 2023)
- https://developer.apple.com/forums/thread/745615 (February 2024)
- https://developer.apple.com/documentation/safariservices/sfaddtohomescreenactivityitem
- https://github.com/brave/brave-browser/issues/42480
- https://github.com/brave/brave-ios/issues/3385
- https://github.com/brave/brave-core/blob/master/ios/brave-ios/Sources/Brave/Frontend/Share/ShareExtensionHelper.swift
- https://github.com/brave/brave-core/blob/master/ios/brave-ios/App/iOS/Entitlements/Release%20(AppStore).entitlements
- https://community.brave.app/t/add-to-home-screen-as-pwa-standalone-web-app-on-ios/650126 (12 March 2026)
- https://brave.com/faq/
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
