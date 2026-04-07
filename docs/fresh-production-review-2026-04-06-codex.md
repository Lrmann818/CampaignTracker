# Fresh Production Review - 2026-04-06

Repo-grounded review of the current Lore Ledger app and review-facing docs.

## Verified during this pass

- `npm run verify` passed locally.
- Repo-wide CheckJS is still not clean; current errors are concentrated in `js/pages/character/panels/abilitiesPanel.js`.
- `npm run test:smoke` was not rerun successfully in this session because port `4173` was already occupied by another local process, so this note treats smoke coverage from the current files/tests as present but not freshly re-executed here.

## Resolved enough to stop flagging

- `app.js` is a real composition root with explicit dependency assembly.
- Tracker page re-init now destroys the previous page controller and panel-owned listeners.
- NPC, Party, and Location panels are instance-scoped controllers with real `destroy()` APIs.
- Tracker incremental DOM dedupe stayed intentionally narrow and did not turn into an over-abstracted renderer layer.
- Replacement flows for portraits, map backgrounds, and drawing snapshots now use a save-before-delete contract.
- Review-facing architecture/testing/release docs are much more current than older review notes implied.

## Must-fix before calling the app fully production-grade

1. Asset deletion paths are still less safe than asset replacement paths.
   - Tracker card deletion deletes the blob before the structured save is durably committed.
   - Map background removal deletes the blob before the null reference is durably committed.
   - Map deletion deletes background/drawing blobs before the map-list mutation is durably committed.
   - On a later save failure, old structured state can survive while the old blobs are already gone.

2. Backup import text staging is not rollback-safe the way blob staging is.
   - Imported texts are written before the state swap.
   - Pre-swap failure cleanup only removes newly written blobs, not newly written texts.
   - Because `putText(...)` overwrites by ID, a failed import can leave text records changed even when state is rolled back.

## Should fix soon

1. Character lifecycle cleanup is improved but still not at tracker parity.
   - Several older panels still rely on dataset guards and/or module-local state instead of destroyable controller scope.

2. Review docs are close, but not fully tidy.
   - `README.md` still lists placeholder docs for `docs/storage.md` and `docs/maintainer-guide.md`, even though the current storage/release docs live elsewhere.
   - `docs/testing-guide.md` slightly overstates staged-asset cleanup during failed backup imports; the more precise nuance currently lives in `docs/storage-and-backups.md`.

3. CheckJS is still not review-ready as a broader quality signal.
   - Current failures are concentrated in `abilitiesPanel.js`, which matches the docs' claim that older Character surfaces remain the main typing gap.

## Reasonable intentional deferrals

- Keeping tracker card body renderers panel-local still looks reasonable.
- Leaving the full tracker rerender shell duplicated for now still looks reasonable.
- Not introducing a controller factory or schema-driven tracker card renderer still looks reasonable.
- Keeping Playwright smoke local-only is acceptable for now as long as the manual release checklist remains real.

## Overall verdict

The app is substantially closer to portfolio-quality and many earlier tracker/storage concerns are genuinely resolved in the current repo. The biggest remaining blockers are no longer broad architecture problems; they are specific data-integrity edge cases around destructive asset flows and backup-import text rollback. Once those are tightened, the remaining Character lifecycle and docs/static-typing gaps look like follow-up hardening rather than structural risk.
