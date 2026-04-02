# Browser Smoke Status

This note records the current Phase 4 browser smoke state for Lore Ledger as it exists in the repo today.

## Current readiness

- No committed browser automation existed before this change.
- The repo already had the right foundation for a small smoke layer:
  - stable Vite production build and preview flow
  - targeted Vitest coverage for migration, persistence, save lifecycle, and backup logic
  - explicit manual smoke and release checklists
  - accessible top-level navigation, stable ids, and custom in-app dialogs that are automation-friendly
- GitHub Pages CI currently gates on `npm ci`, `npm run test:run`, and `npm run build`, but it does not yet run browser smoke coverage.

## Current suite

- The current Chromium suite is genuinely small:
  - 4 smoke tests across app boot, reload persistence, backup export/import, and invalid import handling
  - a clean local run completed in about 4 seconds
- That runtime is cheap enough for CI on its own.
- The suite runs through a dedicated Vite server in production mode:
  - Playwright starts `npm run dev -- --mode production` on the production base path `/CampaignTracker/`
  - the smoke run controls its own server instead of reusing an existing one
- CI would still need an explicit Chromium install step such as `npx playwright install chromium`, which is not wired into the Pages workflow yet

## Current decision

Do not add browser smoke to CI yet.

That is not because the suite is too large. It is because the suite is still intentionally narrow and the repo does not yet provision Playwright Chromium in GitHub Actions. The current local setup is useful and deterministic, but release validation still depends on the broader manual checklist.

## Tooling choice

Playwright is the best fit for this repo right now because it:

- fits the existing Vite-based browser workflow without forcing framework changes
- handles downloads and file inputs cleanly for backup coverage
- can stay intentionally narrow without forcing framework changes
- gives us a straightforward path to later CI use

The initial setup keeps scope to one browser project: Chromium desktop.

## Current smoke scope

The first implemented suite stays limited to release-catching golden paths:

1. App boots and the main shell plus Map workspace render in a real browser.
2. A simple structured edit persists across reload.
3. Backup export works and importing that backup restores the saved state in a fresh context.
4. Invalid backup import fails safely without overwriting live state.

Still intentionally not covered:

- Character-page rendering
- active top-level tab restoration
- `Reset Everything`

This is intentionally not a full end-to-end suite. It focuses on regressions most likely to slip past unit tests while still being deterministic and cheap to maintain.

## Deferred on purpose

These flows matter, but they are not good candidates for the first tiny suite:

- map drawing canvas behavior
- portrait and map-image crop flows driven by the shared hidden image picker
- service worker update prompts and offline cache behavior
- touch gestures and broader cross-browser layout validation

Those areas either depend on more browser-specific behavior, need extra fixture handling, or are better covered in a later focused pass.

## Local run notes

- Playwright browsers are not committed and still need a local install step such as `npx playwright install chromium`.
- The suite uses a dedicated Vite server in production mode with the production base path `/CampaignTracker/`.
- PWA/service-worker validation still needs separate manual preview or deployed-site checks; the smoke suite does not cover offline behavior.
- Import/export is automation-friendly because it uses a normal download and a real file input.
- Image and crop flows are possible to automate later, but they would add more brittleness than value to the first smoke slice.

## Repo touchpoints

- `@playwright/test` as a dev dependency
- `playwright.config.js` targeting the production base path in Chromium smoke tests
- `tests/smoke/app.smoke.js` for app shell and reload-persistence coverage
- `tests/smoke/backup.smoke.js` for backup export/import coverage
- `npm run test:smoke` to run the local Chromium smoke suite

## Remaining gaps

- Character-page rendering
- `Reset Everything`
- image-backed backup restore
- map drawing and gesture behavior
- service worker, update-banner, and offline cache behavior
- Firefox/mobile/cross-browser validation
