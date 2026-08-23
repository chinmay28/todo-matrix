# Quadrants

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

## Local-first

Tasks are stored in the browser's `localStorage` on the device — there is no
server and no account. Loading is defensive (a corrupt value is dropped, never
thrown) and the storage key is versioned (`todo-quadrants/v1`) so a future
schema change can migrate.

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
src/types.ts   quadrant definitions + the importance/urgency → quadrant mapping
src/store.ts   state reducer, task queries, localStorage persistence
src/app.tsx    all UI: matrix overview, quadrant focus view, bottom sheets
src/styles.css mobile-first styling, dark mode, safe-area insets
```

The reducer and persistence layer are pure and UI-free (`store.ts`), so the
component layer stays a thin shell over `dispatch` — and both are covered by
tests (`store.test.ts`, `app.test.tsx`).

## License

[AGPL-3.0-only](LICENSE).
