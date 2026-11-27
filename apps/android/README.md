# To Do Matrix for Android

The Android app (`apps/android`) is To Do Matrix's own web app, carried inside
the APK and shown in a web view — no server, no network, no permissions. This
page is how it is put together and why. Using it is in the
[guide](../../docs/android.md).

```
 ┌───────────────────────────── the phone ──────────────────────────────┐
 │ MainActivity                                                          │
 │  WebView ── https://appassets.androidplatform.net/ ── AppAssets ──┐   │
 │    ▲  todomatrix-bridge.js (document start, that origin only)     │   │
 │    │  TodoMatrixAndroid ⇄ PageBridge                              ▼   │
 │    │     save  → Downloads/To Do Matrix (MediaStore)   APK assets/web/ │
 │    │     share → share sheet (+ Save to Downloads)     (npm run        │
 │    │     about → AboutActivity                          build:android) │
 │    │     counts → CountsWidget (home screen)                           │
 │    │                                                                  │
 │  #add=<quadrant>&title=…  ◀── launcher shortcuts, widget cells,        │
 │                               text shared from other apps (Launch)     │
 └───────────────────────────────────────────────────────────────────────┘
```

## Embedded: the APK is the install

The web app has no server logic — tasks are a versioned JSON blob in
`localStorage` (`src/store.ts`) — so there is nothing for a phone to connect
to. The app ships the built bundle instead and serves it to its own web view:

- **The bundle** is `npm run build:android` — the PWA without its service
  worker and manifest (`vite.config.ts`, `--mode android`), in `dist-android/`.
  The APK is the offline install; a service worker inside it would only be a
  second cache, able to serve a stale bundle after an upgrade. Gradle runs the
  build before `preBuild` (`buildWebBundle`, then `copyWebBundle` into
  `assets/web/`), and fails loudly if there is no `index.html` or if a PWA
  build (with `sw.js`) is in its place. `-PwebBuild=false` uses a
  `dist-android/` built beforehand, as CI does.
- **The origin** is `https://appassets.androidplatform.net/`, served by
  `androidx.webkit.WebViewAssetLoader` (`AppAssets`). A fixed https origin
  rather than `file://`: `localStorage` is per origin, and this one is the
  same on every launch and every upgrade, so the tasks survive both. The host
  is reserved by the WebView; its requests are answered by the app and never
  reach a network. `core/AssetRoute` decides which asset answers which path
  (and refuses anything that would climb out of `web/`).
- **No permissions.** Without `INTERNET` the web view cannot load anything
  from the network at all, which is exactly right: the page needs nothing
  from it. Links out (the source code) go to the phone's browser.

## Native where it pays

The web UI stays the interface; each native piece is small, with its decisions
in `:core`:

| Piece | Why native | Core |
|---|---|---|
| **Launcher shortcuts** *Add to Do / Schedule / Delegate / Later* (`res/xml/shortcuts.xml`) | Two taps from the home screen to the right quadrant's add sheet. | `Launch`, `Launches` |
| **Share target** (`ACTION_SEND text/plain`) | Capture from any app: shared text becomes a task's title. | `ShareText` |
| **Home-screen widget** (`CountsWidget`) | The matrix at a glance; a cell adds to its quadrant. | `Counts` |
| **Backups** through the bridge | A web view has no Downloads or share sheet, and can't hand a `blob:` out. | `Bridge`, `Transfers`, `FileNames`, `AcceptTypes` |
| **About** with the developer badge and its flash | No setup screen exists to carry the version and badge. | `DevFlash` |

**The page hooks are additive.** The web app gained, for everyone:

- `#add[=quadrant][&title=…]` (`src/launch.ts`) — opens the add sheet
  pre-set, on load and on `hashchange` (so a shortcut reaches a page already
  open without reloading it). The installed PWA's own manifest shortcuts use
  it too. `MainActivity` loads `…/#add=do` on a cold start and sets
  `location.hash` on a warm one.
- **⋯ Backup and more** — export (`<a download href="blob:…">`), share
  (`navigator.share({ files })` where the browser can), import
  (`<input type="file">`, merging by id). Format in `src/backup.ts`.
- `window.todomatrixApp` (`src/native.ts`), defined only by the bridge script:
  the page posts its open counts after every change, and offers *About this
  app*. In a browser it is absent and nothing changes.

**The widget never reads the tasks.** The store logic stays in one place, the
web app: the page posts `{do, schedule, delegate, later}` after every change,
`PageBridge` hands it to `CountsWidget`, which keeps it in preferences and
redraws. A widget placed before the app was ever opened shows dashes.

## The page bridge

Ported from SAND Vault's (`sand-bridge.js`, `PageBridge`, `core/Bridge`,
`core/Transfers`): `assets/todomatrix-bridge.js` is added at document start
and `TodoMatrixAndroid` injected, **both for the app's origin alone**
(`addDocumentStartJavaScript` / `addWebMessageListener` with that origin as
the only rule).

| Page does | Bridge sends | App does |
|---|---|---|
| clicks `<a download href="blob:…">` (Export tasks) | `begin`, `chunk`…, `end` with action `save` | writes it to *Downloads/To Do Matrix* through MediaStore |
| `navigator.share({ files })` (Share…) | each file as `stage`, then `share` | opens the share sheet, *Save to Downloads* first |
| `todomatrixApp.counts(c)` | `counts` | updates the widget |
| `todomatrixApp.about()` | `about` | opens `AboutActivity` |

Chunks are 768 KB of base64, each answered before the next; `Transfers` holds
the page to the size it announced and discards a broken transfer, so a half
file never lands in Downloads. SAND Vault's `fetch` (a download from its
server) has no counterpart: there is no server. The page side of this
contract is tested against jsdom in `src/bridge.test.ts`.

## Navigation

`core/NavigationPolicy`: the app's own origin (and `blob:`/`data:`) stays in
the app; other `http(s)`, `mailto:` and app schemes go to the phone; `intent:`
is launched with its component and selector stripped, browsable apps only;
`javascript:`, `file:`, `content:` and the like are refused.

## Version

`versionName`/`versionCode` come from `-PappVersionName`/`-PappVersionCode`
(`dev`/`1` otherwise), which the release workflow sets to
`scripts/version.mjs` and its `--patch` (the commit count, which only grows),
so the About screen, the page's header and the release name agree.

## Icons

Every icon is derived from `public/icon.svg` by `npm run icons`
(`scripts/icons.mjs`, dependency-free: it rasterises the SVG's rounded
rectangles and stroked check mark itself and writes PNGs with `node:zlib`):

| File | What |
|---|---|
| `mipmap-*/ic_launcher.png` | the whole icon, 48dp in every density, rounded on transparency |
| `mipmap-*/ic_launcher_foreground.png`, `mipmap-anydpi-v26/ic_launcher.xml`, `values/ic_launcher_background.xml` | adaptive icon: the quadrants in the 72dp a launcher shows, over the plate colour (`#18181B`, read from the SVG) |
| `mipmap-*/ic_launcher_monochrome.png` | themed icon: the quadrants as one silhouette, check mark cut out |
| `drawable-nodpi/todo_logo.png` | the mark on the About screen and the error panel |
| `drawable-nodpi/dev_badge*.png` | the developer badge, copied from `public/dev-badge*.png` |

`npm test` runs `node scripts/icons.mjs --check`, which fails if any committed
copy differs (pixels, not PNG bytes) from what the SVG makes. Never edit a
derived file; change `public/icon.svg` and run `npm run icons`. The shortcut
icons (`drawable/ic_shortcut_*.xml`) are hand-written vectors in the
quadrant colours. The app posts no notifications, so there is no status-bar
icon.

## Building

```bash
export ANDROID_HOME=/path/to/android-sdk   # platform 35, build-tools 35
npm ci                                      # in the repository root
cd apps/android
./gradlew -PcoreOnly :core:test             # the decisions, no SDK needed
./gradlew :app:lintDebug :app:assembleRelease
```

Releases are signed with one fixed key, read from the `ANDROID_KEYSTORE_BASE64`
and `ANDROID_KEYSTORE_PASSWORD` repository secrets (a PKCS12 keystore, alias
`harbor`, shared by every Harbor app), so each release installs over the last.
A build without them, any local build included, falls back to the debug key.

## Code layout

```
apps/android/
├── core/   plain Kotlin, JVM-tested, no Android:
│           AppOrigin, AssetRoute, NavigationPolicy, Quadrant, Launch
│           (Launches, ShareText), Counts, Bridge, Transfers, FileNames,
│           AcceptTypes, DevFlash
└── app/    the Android shell around it:
            MainActivity (web view), AppAssets, PageBridge +
            assets/todomatrix-bridge.js, Downloads, Sharing,
            SaveToDownloadsActivity, AboutActivity, CountsWidget
```

## Not built

- Android backup of the tasks: the web view's storage is not safe to copy
  while it is open (`allowBackup="false"`). The JSON export is the backup.
- A native task list. The web app is the interface.
