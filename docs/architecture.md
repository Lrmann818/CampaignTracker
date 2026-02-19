# Architecture

This doc captures the intended long-term module boundaries so future refactors are painless.

## Design goals

- **Offline-first**: everything works without a network.
- **Modular**: UI sections are isolated so adding a new page doesn't touch unrelated code.
- **CSP-friendly**: avoid inline scripts/handlers; keep storage + dialogs safe.
- **Low global surface area**: prefer ES module imports; minimize `window.*`.

> Editing rules for AI-assisted changes live in `/AI_RULES.md`.

## Top-level entrypoints

### `index.html`
- Defines the UI shell and page sections.
- Loads `boot.js` (non-module) and `app.js` (module).

### `app.js`
- Orchestrates startup:
  - initializes state
  - loads persistence
  - initializes UI systems (dialogs, navigation, theme, topbar, popovers, data panel)
  - initializes feature UIs (party/NPC/location/session/map/character sheet)
- Owns high-level wiring, not detailed UI rendering.

### `boot.js`
- Reserved for early boot helpers if needed (kept small).
- Avoid putting app logic here when possible.

## Module layers

### `js/state.js`
- Single source of truth for shared state.
- Should not import UI or storage.

### `js/storage/*`
- Persistence + IndexedDB + backups/import/export.
- Must not depend on UI (UI calls storage, not the other way around).

### `js/ui/*`
- Shared UI infrastructure used by feature sections:
  - `dialogs.js` (CSP-safe modals)
  - `navigation.js` (tab/page switching)
  - `theme.js`, `topbar.js`, `popovers.js`, `dataPanel.js`
- UI infra should avoid direct knowledge of party/NPC/location/session specifics.

### `js/features/*`
- Reusable helpers (image picking/cropping flow, autosize, etc.).
- Should not assume a specific page/section; take dependencies as parameters.

### `js/pages/*`
Page-specific UI logic, organized by page.
Examples:
- `js/pages/tracker/*`
- `js/pages/character/*`
- `js/pages/map/*`

## Adding a new page/section

1. Add markup section in `index.html` (e.g. `#page-foo`).
2. Add a tab/button in the nav with matching `data-tab="foo"`.
3. Create a new module in js/pages/<page-name>/foo.js exporting `initFoo(deps)` (+ optional render).
4. Import + wire it in `app.js`.

No storage or other feature modules should require changes.
