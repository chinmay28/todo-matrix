# To Do Matrix

A todo app built around the **Eisenhower matrix**: every task lives in one of
four quadrants, decided by two questions — *is it important?* and *is it
urgent?*

|                   | **Urgent**              | **Not urgent**          |
| ----------------- | ----------------------- | ----------------------- |
| **Important**     | **Do** — do it now      | **Schedule** — decide when |
| **Not important** | **Delegate** — hand it off | **Later** — drop or defer |

It's a mobile-first, installable **PWA** (Vite + React + TypeScript): open it
on your phone, "Add to Home Screen", and it behaves like an app — including
offline.

## Design

- **The matrix is the home screen.** All four quadrants fit on one phone
  screen, each showing its count and the first few open tasks, with the
  Urgent/Important axes labelled — the whole system is visible at a glance.
- **Tap a quadrant to work inside it.** The focus view holds the full list,
  check-off, a completed section, and a quick-add input that files straight
  into that quadrant.
- **Adding asks only the two questions that matter.** The global **+** button
  opens a sheet with a title field and two toggles, *Important* and *Urgent*;
  the resulting quadrant is spelled out live, so the mapping teaches itself.
  (It deliberately defaults to *important, not urgent* — Schedule — because
  marking everything "do now" defeats the matrix.)
- **Tap a task to change your mind.** Rename it, move it to another quadrant
  (one tap, chips colored by destination), or delete it.
- **Nothing is mandatory beyond a title.** No due dates, tags, or projects —
  the quadrant *is* the prioritization.
- **Backups are a file you keep.** The **⋯** button exports every task as a
  JSON file (or shares it, where the browser can share files) and imports one
  back — merging, so an import never removes a task.
- **Shortcuts open the add sheet pre-set.** `/#add=do` (or `schedule`,
  `delegate`, `later`, optionally `&title=…`) opens the add sheet for that
  quadrant; the installed PWA's long-press shortcuts and the Android app's
  launcher shortcuts and share target all use it (`src/launch.ts`).

## Android app

**[To Do Matrix for Android](docs/android.md)** is the same app with nothing
to host: the whole web app is inside the APK, so it needs no server and no
network, and adds launcher shortcuts per quadrant, a share target, a
home-screen widget and backups to Downloads. Install
[`todo-matrix.apk`](https://github.com/chinmay28/todo-matrix/releases/latest/download/todo-matrix.apk)
from the latest release. How it is built: [`apps/android`](apps/android/README.md).

## Quick start (self-host)

One command, run as root on Ubuntu / Debian / Raspberry Pi OS, installs
To Do Matrix as a hardened systemd service (same installer shape as
CountRoster's):

```bash
curl -fsSL https://raw.githubusercontent.com/chinmay28/todo-matrix/main/scripts/quickstart.sh | sudo bash
```

It clones the repo (with the full commit graph, so the version stamps
correctly), builds the PWA with Vite, and serves `dist/` with
`scripts/serve.mjs` — a dependency-free `node:http` static server (SPA
fallback, immutable caching for hashed assets, `no-cache` for the app shell
and service worker so deploys are picked up). **Re-run the same command to
upgrade**: the new bundle builds while the old one keeps serving, the web
root is swapped only after a successful build, and a failed health check
rolls back to the previous web root. There is no server-side data — tasks
live in each browser — so an upgrade can never lose them.

To uninstall, run the same command with `--uninstall`:

```bash
curl -fsSL https://raw.githubusercontent.com/chinmay28/todo-matrix/main/scripts/quickstart.sh | sudo bash -s -- --uninstall
```

It stops and disables the `todo-matrix` service, removes its unit file and
deletes the install prefix (`/opt/todo-matrix`: source, web root and
`serve.mjs`). It keeps the `todomatrix` service user (it prints the `userdel`
command) and Node; your tasks are in each browser, so they are untouched. It
is safe to run when nothing is installed. Set the same `TODOMATRIX_*`
variables you installed with if you changed the prefix or user.

Configure with environment variables (all optional): `TODOMATRIX_REPO`,
`TODOMATRIX_REF`, `TODOMATRIX_USER`, `TODOMATRIX_PREFIX`, `PORT` (default
8688), `HOST`, `INSTALL_NODE` — see the header of
[`scripts/quickstart.sh`](scripts/quickstart.sh).

> Installing as an app and offline use need **HTTPS** (the service worker
> requires a secure context): front the service with Tailscale Serve or a
> reverse proxy (Caddy/nginx) rather than exposing plain HTTP.

## Local-first

Tasks are stored in the browser's `localStorage` on the device — there is no
server and no account. Loading is defensive (a corrupt value is dropped, never
thrown) and the storage key is versioned (`todo-matrix/v1`) so a future
schema change can migrate.

## Versioning

Versions are calendar-based, `vYEAR.MONTH.<commit count>` (the scheme shared
with [sand-vault](https://github.com/chinmay28/sand-vault)): `v2026.11.311` is
the 311th commit, made in November 2026. YEAR.MONTH is the month of HEAD's
**committer date**, in the committer's own timezone, so nobody bumps anything:
the line moves with the first commit of a new month, and a rebuild of an old
commit still names the version it shipped as. It is never the build clock.
[`scripts/version.mjs`](scripts/version.mjs) is the one place the number is
assembled (`--patch` prints the count, `--date` the commit's `YYYY-MM`); Vite
inlines it into the bundle (`define`) and the Android build stamps the same
string and count into the APK, so the header, the APK and the release agree.
Without git (a tarball) it falls back to the build month and patch `0`.

The count needs the full commit graph: a `--depth 1` clone answers it with
`1`, silently, so `version.mjs` refuses a shallow repo (reports 0 instead of
the fake count). Clone with `--filter=blob:none` if you want a cheap clone
that still versions correctly. The running version shows under the app name
in the header; **don't assert the literal version string in a test** — it
changes with every commit.

## Commands

Requires Node >= 20.

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable on your tailnet)
npm test           # vitest (store, component, bridge tests) + the icon drift check
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production bundle in dist/
npm run build:android  # the same bundle without the service worker, for the APK
npm run preview    # serve the production build
```

To try it from a phone during development, run `npm run dev -- --host` and open
the machine's address; `.ts.net` hosts (Tailscale MagicDNS) are pre-allowed.

## Layout

```
src/types.ts          quadrant definitions + the importance/urgency → quadrant mapping
src/store.ts          state reducer, task queries, localStorage persistence
src/backup.ts         the backup file format (export / import)
src/launch.ts         the #add=… launch hash (shortcuts, share target)
src/native.ts         detection of the Android app's bridge (window.todomatrixApp)
src/app.tsx           all UI: matrix overview, quadrant focus view, bottom sheets
src/styles.css        mobile-first styling, dark mode, safe-area insets
scripts/version.mjs   the one place the version number is assembled
scripts/serve.mjs     dependency-free static server (production serving path)
scripts/quickstart.sh one-command self-host installer / upgrader / uninstaller (systemd)
scripts/icons.mjs     derives every Android icon from public/icon.svg (npm run icons)
apps/android/         the Android app (Kotlin; the web bundle in its assets)
docs/android.md       the Android app's user guide
```

## Releases

Pushing a `v*` tag, a manual dispatch, or a push to `main` whose version has a
`## vYEAR.MONTH.PATCH` section in [`CHANGELOG.md`](CHANGELOG.md) runs
[`release.yml`](.github/workflows/release.yml): it refuses patch 0 and a tag
that isn't its commit's version, then publishes `todo-matrix-<version>.tar.gz`
(the built `www/` and `serve.mjs`), `todo-matrix.apk` and `SHA256SUMS`, with
that changelog section as the release notes.

The reducer and persistence layer are pure and UI-free (`store.ts`), so the
component layer stays a thin shell over `dispatch` — and both are covered by
tests (`store.test.ts`, `app.test.tsx`).

## License

[AGPL-3.0-only](LICENSE).
