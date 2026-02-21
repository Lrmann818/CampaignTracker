# Campaign Tracker

A lightweight, offline-first Campaign Tracker web app (vanilla HTML/CSS/JS) for managing:
- Party cards
- NPC cards
- Location cards
- Sessions
- Character sheet
- Interactive maps (draw layer + touch/pan/zoom)

## Run locally

This project is designed to run with a simple static server (recommended so ES modules load correctly).

- VS Code: **Live Server**
- Or any local server of your choice

Then open the served URL (not a `file://` path).

## Project structure (high level)

- `index.html` – app shell / markup
- `styles.css` – global styling
- `boot.js` – early boot (non-module) helpers if needed
- `app.js` – main module orchestrator (wires state, storage, UI, features)

Modules:
- `js/state.js` – shared app state + defaults
- `js/storage/*` – persistence, IndexedDB, backups/import/export
- `js/ui/*` – dialogs, navigation, theme, topbar, popovers, data panel
- `js/features/*` – reusable feature helpers (autosize, image picker/cropper/flow)
- `js/pages/*` – Page-specific UI logic. (party, NPCs, locations, sessions, map, character sheet)

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
