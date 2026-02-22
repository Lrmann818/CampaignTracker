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

## Release

Build a release zip and verify it does not contain dev-only content (`.git/`, `node_modules/`, `dist/`, `.vscode/`, `.DS_Store`, `Thumbs.db`):

```powershell
.\scripts\make-zip.ps1
```

Output format:
- `refactor-export-YYYYMMDD-HHMM.zip`
- Script output includes: `Release zip is clean`

Optional output folder:

```powershell
.\scripts\make-zip.ps1 -OutputDir .\exports
```

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

## DEV flags

Development mode is auto-enabled on local hosts (`localhost`, `127.0.0.1`, `::1`, `*.local`).

- `?dev=1` enables DEV mode.
- `?dev=0` disables DEV mode.
- `?stateGuard=warn` enables warning-only mutation guard mode.
- `?stateGuard=throw` enables throwing mutation guard mode.
- `?stateGuard=off` disables the mutation guard.

Recommended querystrings:
- `/?dev=1&stateGuard=warn`
- `/?dev=1&stateGuard=throw`
- `/?dev=1&stateGuard=off`

Behavior summary:
- DEV off: mutation guard is off unless explicitly requested.
- DEV on + warn: direct out-of-scope state writes warn once per path.
- DEV on + throw: direct out-of-scope state writes throw with a helper message.
- Normal app UI usage remains functional in DEV guard modes because registered UI lifecycle callbacks are treated as allowed mutation scopes.

Quick guard check from console in DEV mode:
- `__APP_STATE__.tracker.campaignTitle = "Guard test"`

When enabled, direct state writes outside action helpers log warnings (or throw in `throw` mode) and point to `createStateActions(...)` helpers.

See `docs/architecture.md` for the intended boundaries and how the modules fit together.
