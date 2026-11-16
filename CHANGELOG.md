# Changelog

Releases are `vYEAR.MONTH.PATCH` — a calendar version, where YEAR.MONTH is the
month of the release's commit and the patch number is the repository's commit
count, so `v2026.11.42` is the 42nd commit, made in November 2026. See
[`scripts/version.mjs`](./scripts/version.mjs).

Each section below is the body of the corresponding GitHub release, and is
also what publishes it: the release workflow builds a commit only when this
file has a heading naming that commit's version exactly. A push to `main`
without one is an ordinary commit and is skipped; a tag without one fails.
`## Unreleased` never matches a version — rename it to the version when
cutting the release.

## v2026.11.13

**Downloads:** **`todo-matrix.apk`** (new: To Do Matrix for Android — on the
phone, open
`https://github.com/chinmay28/todo-matrix/releases/latest/download/todo-matrix.apk`
and install it; see [`docs/android.md`](./docs/android.md)) and
`todo-matrix-<version>.tar.gz` (the built web app and its static server, as
the self-host installer lays them out). Both are in `SHA256SUMS`.

### To Do Matrix for Android

The matrix as an app of its own. The whole web app is inside the APK, so it
needs no server, no network and no permissions, and works offline from the
moment it is installed; tasks are kept on the phone and survive upgrades.

- **Launcher shortcuts:** long-press the icon for *Add to Do*, *Schedule*,
  *Delegate* or *Later* — the add sheet opens already set to that quadrant.
- **Share to it:** text shared from any app becomes a new task's title.
- **Widget:** the four quadrants' open counts on the home screen; tap one to
  add to it.
- **Backups** save to *Downloads/To Do Matrix* or go out through the share
  sheet, and import from the file picker.
- **About** shows the installed version and the developer badge.

### Backups in the web app

**⋯** in the header exports every task as a JSON file, shares it where the
browser can share files, and imports one back. Importing merges: a task both
sides have takes the backup's version, and nothing is ever removed. The same
file moves tasks between browsers and the Android app.

### Add shortcuts in the web app

`/#add=do` (or `schedule`, `delegate`, `later`, optionally `&title=…`) opens
the add sheet pre-set, and the installed PWA's long-press menu offers the four
*Add to …* shortcuts.

### Versioning follows the commit

YEAR.MONTH is now the month of the commit being built rather than constants in
`scripts/version.mjs`, so nothing needs bumping when a month turns; the same
commit always builds the same version.
