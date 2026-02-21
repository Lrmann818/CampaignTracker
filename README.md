# Campaign Tracker

A lightweight, offline-first Campaign Tracker web app (vanilla HTML/CSS/JS) for managing:
- Party cards
- NPC cards
- Location cards
- Sessions
- Character sheet
- Interactive maps (draw layer + touch/pan/zoom)

## Run locally

This project uses ES modules (`<script type="module" src="app.js"></script>`), so run it from a static server.

- VS Code: **Live Server**
- Or any local static server of your choice

Then open the served URL (not a `file://` path).

## Project structure (high level)

- `index.html` - app shell/markup + CSP + root page sections
- `styles.css` - global styling
- `boot.js` - pre-module boot for initial theme + app version exposure
- `app.js` - composition root (state guard, persistence wiring, shared UI systems, page init)
- `docs/architecture.md` - intended boundaries + current wiring details

`js/` modules:
- `js/state.js` - app state defaults, migrations, save sanitization, map-manager helpers
- `js/domain/*` - domain factories + explicit state action helpers
- `js/storage/*` - localStorage + IndexedDB (blobs/text) + backup/import/export + save manager
- `js/ui/*` - shared UI infrastructure (dialogs, navigation, popovers, topbar, settings/data panel, bindings)
- `js/features/*` - reusable feature helpers (autosize, image picker/cropper/portrait flow, steppers)
- `js/pages/tracker/*` - tracker page wiring + panel modules (`sessions`, `npcCards`, `partyCards`, `locationCards`, shared card helpers)
- `js/pages/character/*` - character page wiring + panel modules
- `js/pages/map/*` - map page setup + controller/ui/persistence/history/gesture/drawing modules
- `js/utils/*` - dev/state-guard helpers, DOM guards, general utilities

## Notes

- The app uses a strict CSP in `index.html`.
- Images use `blob:` + `data:` URLs and are stored via the storage layer.

## Dev mutation guard

Development mode is auto-enabled on local hosts (`localhost`, `127.0.0.1`, `::1`, `*.local`).

- Force enable DEV mode: add `?dev=1`
- Force disable DEV mode: add `?dev=0`
- Mutation guard modes: `?stateGuard=warn` (default in DEV), `?stateGuard=throw`, `?stateGuard=off`

When enabled, direct state writes outside action helpers log warnings (or throw in `throw` mode) and point to `createStateActions(...)` helpers.

See `docs/architecture.md` for the intended boundaries and how the modules fit together.
