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
with [sand-vault](https://github.com/chinmay28/sand-vault)): `v2026.8.311` is
the 311th commit on the 2026.8 line. `Year`/`Month` are constants in
`scripts/version.mjs` — the one place the number is assembled — and the patch
number can only come from git, so it's stamped into the bundle at build time
(Vite `define`). An unstamped build reports patch `0`.

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
npm test           # vitest (store + component tests)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production bundle in dist/
npm run preview    # serve the production build
```

To try it from a phone during development, run `npm run dev -- --host` and open
the machine's address; `.ts.net` hosts (Tailscale MagicDNS) are pre-allowed.

## Layout

```
src/types.ts          quadrant definitions + the importance/urgency → quadrant mapping
src/store.ts          state reducer, task queries, localStorage persistence
src/app.tsx           all UI: matrix overview, quadrant focus view, bottom sheets
src/styles.css        mobile-first styling, dark mode, safe-area insets
scripts/version.mjs   the one place the version number is assembled
scripts/serve.mjs     dependency-free static server (production serving path)
scripts/quickstart.sh one-command self-host installer / upgrader / uninstaller (systemd)
```

The reducer and persistence layer are pure and UI-free (`store.ts`), so the
component layer stays a thin shell over `dispatch` — and both are covered by
tests (`store.test.ts`, `app.test.tsx`).

## License

[AGPL-3.0-only](LICENSE).
