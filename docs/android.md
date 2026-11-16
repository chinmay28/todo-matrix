# To Do Matrix on Android

The To Do Matrix app is the same matrix as the web app, installed on an
Android phone as an app of its own. It needs no server and no network: the
whole app is inside the APK, your tasks are kept on the phone, and it works
from the moment it is installed — on a plane, in airplane mode, anywhere.

Everything the web app does, the phone app does — the four quadrants, adding,
completing, moving, renaming, the completed list — because it is the same web
app. This page covers what is different on a phone. How it works inside is in
[the app's design](../apps/android/README.md).

## Install the app

Every [release](https://github.com/chinmay28/todo-matrix/releases) attaches
it as `todo-matrix.apk`, and the latest is always at:

```
https://github.com/chinmay28/todo-matrix/releases/latest/download/todo-matrix.apk
```

Open that address on the phone, download the APK, and open it. Android asks
once to let your browser install apps; allow it. A newer release installs over
the old one and keeps your tasks.

It needs Android 10 or newer. It asks for no permissions at all — not even
network access.

## Where your tasks are

On the phone, inside the app's own storage, and nowhere else. They are not
the same tasks as the web app's in your phone's browser, or on a self-hosted
server's page: each browser, and the app, keeps its own.

That makes them easy to lose by accident — **uninstalling the app or clearing
its storage deletes them**, and Android's own backup does not copy them. Keep
a backup (below) if they matter.

## Backups: export, share, import

Tap **⋯** in the header of the matrix:

- **Export tasks** saves every task, completed ones included, as
  `todo-matrix-<date>.json` in **Downloads/To Do Matrix**.
- **Share…** sends the same file through the phone's share sheet — to Drive,
  mail, a chat, or another phone. **Save to Downloads** is always first in the
  sheet.
- **Import tasks** opens the file picker; pick a backup from Downloads, Drive
  or anywhere else. Importing **adds** the backup's tasks to the ones already
  there: a task both have takes the backup's version, and nothing is ever
  removed.

The file is the same one the web app exports, so a backup moves tasks between
the app, any browser, and back.

## Adding from outside the app

- **Long-press the app's icon** for *Add to Do*, *Add to Schedule*,
  *Add to Delegate* and *Add to Later*: the add sheet opens already set to
  that quadrant. Drag one to the home screen to keep it there. (*About* is the
  fifth; some launchers show only four.)
- **Share text to it.** In any app's share sheet, *To Do Matrix* takes the
  shared text as a new task's title — a page from the browser becomes
  *its title — its address*. You choose the quadrant before adding, as with
  the **+** button.

## The widget

Add the **To Do Matrix** widget from your launcher's widget list: the four
quadrants with their open counts, in the matrix's own layout. Tap a quadrant
to add a task to it. The counts change as you work in the app; until you have
opened the app once, the widget shows dashes.

## About

**⋯ → About this app** (or *About* on the long-press menu) shows the version
of the installed app — the same `vYEAR.MONTH.PATCH` the web app shows under
its name — and the developer badge; tap the badge to see it full screen.

## Not here

- **Syncing between devices.** There is no server and no account: a backup
  file is how tasks move.
- **Reminders and notifications.** The matrix has no due dates, so there is
  nothing to remind you of.
