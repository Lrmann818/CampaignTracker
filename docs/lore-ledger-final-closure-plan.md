# Lore Ledger Final Closure Plan

This plan turns the last review findings into a **commit-sized execution checklist** so the repo can reach a true “closure/hardening release” state with no ambiguous loose ends.

## Goal

When this pass is done, the repo should have:

- no unresolved data-integrity risks
- no meaningful lifecycle cleanup gaps in active surfaces
- no small-but-known hardening loose ends
- no stale or misleading review/docs wording
- no fuzzy “intentionally deferred” items still floating as pseudo-TODOs

The standard is not “implement every imaginable refactor.”  
The standard is: **fix real risks, close small gaps, and explicitly disposition the rest.**

---

## Release framing

Use this as a **closure / hardening release**:

- **Target:** `v0.5.0`
- **Theme:** integrity, cleanup, truthfulness, review-readiness
- **Rule:** prefer small safe changes over late-stage architectural churn

---

## Working rules for every step

For every Codex pass:

1. Keep scope tight.
2. Preserve current user-visible behavior unless correctness requires change.
3. Avoid broad abstractions unless they remove real duplication cleanly.
4. Do not use `@ts-nocheck`.
5. Do not hide problems with blanket suppressions.
6. Add or update focused tests when behavior changes.
7. End each pass with:
   - files changed
   - tests updated
   - verification commands run
   - results

---

## Suggested branch / commit strategy

Create one closure branch and keep commits small and reviewable.

Suggested branch name:

```bash
git checkout -b final-closure-v0.5.0
```

Suggested commit grouping:

1. integrity fixes
2. storage/helper cleanup
3. small hardening gaps
4. character lifecycle cleanup
5. final type-check cleanup
6. docs/disposition/testing closure

---

# Execution checklist

## Batch 1 — Integrity fixes first

These are the last items that should still be treated as real blockers.

### Step 1. Fix destructive asset deletion ordering
**Priority:** Highest  
**Outcome:** delete/remove flows become save-first, delete-after-commit safe

#### What this covers
- tracker portrait delete/remove flows
- map background removal
- map deletion flows involving blob-backed assets

#### Why this matters
Right now, if any flow deletes blob assets before the structured save is durably committed, a later save failure can leave the user with state that still references assets that are already gone.

#### Done looks like
- no destructive flow deletes blobs before the state save succeeds
- rollback/failure preserves prior data
- tests prove ordering and failure behavior

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Fix all destructive asset deletion flows so they follow the same integrity model already used by blob replacement:
1) stage the state change,
2) durably save/commit the structured state,
3) only then delete old blob assets,
4) restore/rollback safely on failure.

Scope:
- Inspect current safe replacement flow in js/storage/blobReplacement.js and reuse its design principles.
- Fix any delete/remove flows that currently delete blobs before the structured save is durably committed.
- Based on the latest review, this likely includes tracker card portrait deletion flows and map background/map deletion flows.
- Keep the solution small and production-grade. Prefer extracting a tiny shared helper if it reduces duplicated “commit then delete” logic cleanly.
- Do not introduce broad architectural refactors.
- Preserve current UI behavior and messages unless a change is required for correctness.

Required work:
- Update code so blob deletion happens only after the new structured state is durably saved.
- Add/expand focused tests for:
  - tracker portrait delete flow
  - map background remove flow
  - map delete flow
  - failure path proving old state/blob references are not left corrupted by early deletion
- Verify npm test and npm run build still pass.

Acceptance criteria:
- No destructive flow deletes blob assets before the related state save has succeeded.
- Failure before commit preserves prior user data.
- Tests explicitly cover ordering and rollback behavior.
- Output a concise summary:
  1) files changed
  2) exact flows fixed
  3) what tests were added/updated
  4) verification commands and results
```

#### Suggested commit message
```bash
git commit -m "Harden destructive asset deletion ordering"
```

---

### Step 2. Fix backup import text rollback safety
**Priority:** Highest  
**Outcome:** failed imports cannot silently overwrite stored texts

#### Why this matters
Blob rollback safety is already a focus area. Text records need the same standard so a failed import cannot partially overwrite prior persisted text data.

#### Done looks like
- import text writes are staged or rollback-safe
- text ID collisions are covered
- docs no longer overstate import rollback safety

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Harden backup import so text staging/writes are rollback-safe, not just blob staging.

Problem to solve:
Latest review found that backup import writes text records before the final state swap/commit, but pre-swap cleanup only tracks blobs. Because text storage uses put-by-id semantics, a failed import may overwrite existing text records even if app state is rolled back.

Requirements:
- Inspect js/storage/backup.js and js/storage/texts-idb.js.
- Implement a production-grade approach so text writes during import are either:
  - safely staged and only committed on success, or
  - fully restorable/rollback-safe if failure occurs after text writes begin.
- Keep the solution minimal and explicit. Avoid giant abstractions.
- Add focused tests for:
  - text ID collision during import
  - failed import after text writes begin
  - rollback restores previous text data correctly
  - successful import still commits correctly
- Update any docs that currently overstate backup rollback coverage.

Acceptance criteria:
- A failed import cannot silently overwrite prior text records.
- Backup import rollback semantics are truthful and test-covered for both blobs and texts.
- Existing successful import/export behavior remains intact.
- Output:
  1) design chosen and why
  2) files changed
  3) tests added/updated
  4) verification results
```

#### Suggested commit message
```bash
git commit -m "Make backup text import rollback-safe"
```

---

## Batch 2 — Small storage/hardening cleanup

These are not blockers, but they are exactly the sort of loose ends worth closing in a final hardening pass.

### Step 3. Extract shared state clone / bucket replacement helper
**Priority:** High  
**Outcome:** remove tiny duplicated persistence logic

#### Done looks like
- duplicate clone/replace helpers are consolidated
- behavior is unchanged
- storage architecture stays clean and narrow

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Remove the remaining duplication around cloneState/cloneAppState and replaceStateBuckets between persistence-related modules.

Requirements:
- Inspect js/storage/persistence.js and js/storage/backup.js.
- Extract the shared logic into a small, well-named shared storage helper module.
- Keep the helper narrow: only the duplicated bucket clone/replace behavior, nothing broader.
- Update imports/call sites cleanly.
- Preserve behavior exactly.
- Add or update tests only if needed to protect the extraction.

Acceptance criteria:
- No duplicated cloneState/cloneAppState + replaceStateBuckets logic remains between persistence.js and backup.js.
- Behavior is unchanged.
- The new helper location/name fits the current storage architecture.
- Output changed files and verification results.
```

#### Suggested commit message
```bash
git commit -m "Extract shared storage state clone helpers"
```

---

### Step 4. Consolidate `hitDieAmount` alias normalization
**Priority:** High  
**Outcome:** migration becomes the single canonical normalization point

#### Done looks like
- only one normalization path remains
- legacy saves still load correctly
- optional dev assertion catches bad runtime writes early

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Consolidate hitDieAmount -> hitDieAmt normalization so there is a single canonical normalization point, without weakening save safety.

Context:
Latest review noted this alias normalization currently exists in both migration and sanitizeForSave. That works, but duplicates domain normalization logic.

Requirements:
- Inspect the migration and save sanitization paths.
- Make migration the canonical normalization layer.
- Remove duplicated alias normalization from sanitizeForSave if safe to do so.
- If needed, add a lightweight dev-mode assertion/guard so accidental runtime use of hitDieAmount is caught earlier and noisily during development.
- Update/add tests as needed to preserve behavior.

Acceptance criteria:
- Only one canonical normalization path remains.
- The app still saves/loads correctly for legacy data.
- Any new dev guard is small and non-invasive.
- Output:
  1) what changed
  2) whether a dev assertion was added
  3) tests updated
  4) verification results
```

#### Suggested commit message
```bash
git commit -m "Canonicalize hit-die alias normalization in migration"
```

---

### Step 5. Remove the `applyTextareaSize` boot-order footgun
**Priority:** Medium  
**Outcome:** tracker deps no longer rely on fragile capture timing

#### Done looks like
- dependency lookup is ordering-independent
- no current behavior change
- future boot refactors are safer

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Remove the latent boot-order footgun around applyTextareaSize dependency capture in tracker page dependency assembly.

Context:
Latest review noted the current code works because setupTextareaSizing runs synchronously before tracker deps are created, but the dependency is captured by value and could silently become undefined if boot ordering changes later.

Requirements:
- Inspect app.js and the tracker dependency assembly path.
- Make applyTextareaSize resolution ordering-independent in the smallest clean way.
- Prefer a getter or equivalent explicit lazy lookup over broad refactoring.
- Preserve current behavior exactly.
- Add a focused test only if the repo already has a good place for it; otherwise keep the change tiny and well-commented.

Acceptance criteria:
- Tracker deps no longer rely on fragile boot ordering for applyTextareaSize.
- No behavior change for current startup.
- Output changed files and rationale.
```

#### Suggested commit message
```bash
git commit -m "Harden tracker textarea sizing dependency lookup"
```

---

### Step 6. Add `@ts-check` to small remaining shared utilities
**Priority:** Medium  
**Outcome:** utility layer has fewer obvious type-check gaps

#### Done looks like
- `domGuards.js` and `number.js` are `@ts-check`
- minimal JSDoc added where needed
- no type-safety theater

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Close the small shared-utility typing gaps by adding // @ts-check to the remaining lightweight utility modules called out in review.

Target:
- js/.../domGuards.js
- js/.../number.js
(Find the exact paths in the repo and use them.)

Requirements:
- Add // @ts-check.
- Introduce minimal JSDoc typedefs/annotations as needed.
- Do not use @ts-nocheck.
- Do not weaken types with vague catch-all shapes unless truly necessary.
- Keep the modules simple and readable.
- Run the relevant check/build/test commands afterward.

Acceptance criteria:
- Both utility modules are on @ts-check cleanly.
- No new type theater or suppression comments.
- Output:
  1) exact files updated
  2) any typedefs added
  3) whether repo-wide CheckJS improved
  4) verification results
```

#### Suggested commit message
```bash
git commit -m "Add ts-check to shared utility modules"
```

---

## Batch 3 — Character lifecycle parity pass

This is where you close the last meaningful “should fix soon” bucket.

### Step 7. Attack panel lifecycle cleanup
**Priority:** High  
**Outcome:** attack panel becomes instance-scoped and teardown-safe

#### Done looks like
- no stale module-local or leaked listener behavior
- explicit cleanup on destroy/re-init
- coverage proves no double-bind behavior

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Bring the Character attack panel up to the same lifecycle discipline standard as the hardened tracker panels and current character page controller.

Primary target:
- js/pages/character/panels/attackPanel.js

Requirements:
- Remove any module-local or stale closure state that can survive re-init incorrectly.
- Ensure persistent DOM listeners are owned and cleaned up explicitly.
- Prefer AbortController or explicit destroyFns, matching repo conventions.
- Preserve current behavior/UI.
- Keep the panel instance-scoped and destroyable.
- Add or update smoke/unit coverage proving re-init does not double-bind or leak behavior.

Acceptance criteria:
- Re-initializing/destroying the character page does not leave attack panel duplicate listeners or stale state behind.
- The panel follows the repo’s current lifecycle conventions.
- Output:
  1) what lifecycle issues were present
  2) what changed
  3) tests added/updated
  4) verification results
```

#### Suggested commit message
```bash
git commit -m "Bring attack panel to explicit lifecycle cleanup standard"
```

---

### Step 8. Vitals panel lifecycle cleanup
**Priority:** High  
**Outcome:** vitals panel matches current teardown conventions

#### Done looks like
- dataset-guard style workarounds removed where they are masking lifecycle ownership
- explicit cleanup for persistent listeners/subscriptions/timers
- re-init safety is covered

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Bring the Character vitals panel up to the repo’s current lifecycle/teardown standard.

Primary target:
- js/pages/character/panels/vitalsPanel.js

Requirements:
- Remove reliance on dataset guards or module-local state where they are substituting for true lifecycle ownership.
- Ensure any persistent listeners/timers/subscriptions are explicitly cleaned up on destroy.
- Keep behavior unchanged.
- Match existing project conventions for controller teardown.

Acceptance criteria:
- No duplicate bindings or stale state after character page destroy/re-init cycles.
- The panel exposes/participates in explicit lifecycle cleanup cleanly.
- Add/update targeted coverage as appropriate.
- Output changed files, tests, and verification results.
```

#### Suggested commit message
```bash
git commit -m "Bring vitals panel to explicit lifecycle cleanup standard"
```

---

### Step 9. Abilities panel lifecycle cleanup + CheckJS cleanup
**Priority:** Highest in Character pass  
**Outcome:** abilities panel becomes both lifecycle-safe and type-check clean

#### Done looks like
- no stale lifecycle patterns remain
- current CheckJS failure is removed
- targeted tests/smoke prove re-init safety

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Finish the Abilities panel cleanup by fixing both lifecycle discipline issues and its current CheckJS failures.

Primary target:
- js/pages/character/panels/abilitiesPanel.js

Requirements:
- Inspect the panel for stale lifecycle patterns, dataset guards, or module-local state that survive re-init.
- Refactor to instance-scoped ownership with explicit cleanup where needed.
- Make the file // @ts-check clean without using @ts-nocheck.
- Add the smallest helpful typedefs/JSDoc needed.
- Preserve current UI behavior.

Acceptance criteria:
- abilitiesPanel.js is lifecycle-safe on character page destroy/re-init.
- abilitiesPanel.js no longer fails the current CheckJS pass.
- Add/update targeted tests or smoke coverage proving no duplicate binding behavior.
- Output:
  1) lifecycle fixes made
  2) typing fixes made
  3) tests updated
  4) verification results
```

#### Suggested commit message
```bash
git commit -m "Finish abilities panel lifecycle and checkjs cleanup"
```

---

## Batch 4 — Final CheckJS closure pass

### Step 10. Final active-code CheckJS cleanup
**Priority:** High  
**Outcome:** no meaningful active/shared type-check failures remain

#### Done looks like
- repo-wide CheckJS is green, or
- only tiny explicitly justified exclusions remain and are documented honestly

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Run a focused final CheckJS closure pass after the Character panel cleanup and eliminate any remaining meaningful type-check failures that are still in active/shared app code.

Requirements:
- Run the repo’s current broad CheckJS/type-check pass.
- Identify any remaining real failures in active/shared code.
- Fix them in the smallest production-grade way.
- Do not launch a giant leaf-module crusade unless the failures are real and current.
- Avoid blanket suppressions and avoid @ts-nocheck.
- If test-only or intentionally legacy dead-end code remains, document that clearly rather than hiding it.

Acceptance criteria:
- Repo-wide CheckJS is green, or any remaining exclusions are explicitly justified, tiny, and documented.
- Output:
  1) exact command run
  2) failures found
  3) fixes made
  4) final status
```

#### Suggested commit message
```bash
git commit -m "Close remaining active-code CheckJS gaps"
```

---

## Batch 5 — Docs and disposition closure

This batch is how you end with no fuzzy review residue.

### Step 11. Final docs truthfulness pass
**Priority:** High  
**Outcome:** docs index and review-facing docs match reality everywhere

#### Done looks like
- no placeholder links to nonexistent docs
- no overstated backup/import claims
- testing/architecture/review docs all agree

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Do a final docs truthfulness pass so the repo documentation is fully review-ready and contains no stale placeholders or overstated claims.

Focus areas:
- README docs index
- backup/import rollback wording
- testing-guide wording
- any review-facing docs that still imply outdated status

Requirements:
- Remove placeholder links/docs that do not exist.
- Make the docs index reflect the actual current document set.
- Update wording anywhere backup import safety was previously overstated before the new text rollback fix.
- Keep docs concise, accurate, and aligned with current architecture/tests.
- Do not invent new docs unless needed to replace a broken placeholder with a real current document.

Acceptance criteria:
- README and review-facing docs are internally consistent and truthful.
- No placeholder/nonexistent doc references remain.
- Output exact files updated and a brief summary of wording changes.
```

#### Suggested commit message
```bash
git commit -m "Tighten docs for final review readiness"
```

---

### Step 12. Disposition all intentionally deferred items explicitly
**Priority:** High  
**Outcome:** deferred work becomes explicit product decisions, not lingering TODO fog

#### Done looks like
Each remaining deferred item is classified as one of:
1. done now
2. intentionally out of scope
3. future roadmap item, not release-quality debt

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Eliminate ambiguous deferred-work language from the repo by converting remaining “intentionally deferred” items into explicit dispositioned decisions.

Requirements:
- Review the current architecture/testing/review docs for items described as intentionally deferred, nice-to-have later, future work, or known gaps.
- For each item, choose one of:
  1) done now
  2) intentionally out of scope for this app/version
  3) future feature roadmap item, not a release-quality blocker
- Update docs so there is no vague “TODO drift.”
- Preserve honesty: do not pretend gaps are solved if they are simply out of scope.
- Keep it concise and professional.

Acceptance criteria:
- Remaining deferred items are explicitly dispositioned, not left as fuzzy open loops.
- The repo can honestly be described as having no unresolved release-quality blockers.
- Output:
  1) items dispositioned
  2) which were marked out-of-scope vs roadmap
  3) files changed
```

#### Suggested commit message
```bash
git commit -m "Disposition deferred items explicitly"
```

---

## Batch 6 — Final smoke coverage closure

### Step 13. Add the last highest-value smoke coverage
**Priority:** Medium  
**Outcome:** the most meaningful remaining user-flow gaps are either covered or explicitly left manual by design

#### Done looks like
- highest-signal missing smoke paths are added
- docs name what remains manual on purpose
- no attempt to automate every last browser/PWA edge

#### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Close the highest-value remaining smoke coverage gaps for a final production-readiness pass, without ballooning the Playwright suite.

Focus on the most meaningful missing user flows still called out in docs/reviews, likely including:
- deeper Character panel re-init coverage
- restore/reset coverage if still lightly covered
- one meaningful map interaction lifecycle path
- any high-value local-only browser smoke path still missing

Requirements:
- Keep the suite practical and maintainable.
- Add only the highest-signal smoke tests.
- Update testing docs to reflect the exact current smoke scope honestly.
- Do not attempt to fully automate every manual/browser/PWA edge.

Acceptance criteria:
- The smoke suite covers the most important remaining real-user flows still identified as gaps.
- Docs match the final scope exactly.
- Output:
  1) new smoke cases added
  2) what remains manual by design
  3) verification results
```

#### Suggested commit message
```bash
git commit -m "Expand final high-value smoke coverage"
```

---

# Final verification pass

After all batches are done, run the full verification sweep.

Suggested sequence:

```bash
npm test
npm run build
npm run verify
npm run test:smoke
```

If `npm run test:smoke` fails due to local environment issues like port conflicts, resolve that and rerun so the final closure pass has a truthful fresh smoke result.

---

# Final review checklist

Use this checklist before calling the pass complete.

## Code / integrity
- [ ] No destructive asset flow deletes blobs before durable save succeeds
- [ ] Backup import text writes are rollback-safe
- [ ] Shared clone/replace helpers are consolidated cleanly
- [ ] `hitDieAmount` alias normalization has one canonical home
- [ ] `applyTextareaSize` dependency capture is no longer boot-order fragile

## Lifecycle / architecture
- [ ] Attack panel is re-init safe
- [ ] Vitals panel is re-init safe
- [ ] Abilities panel is re-init safe
- [ ] No meaningful stale dataset-guard lifecycle hacks remain in active Character panels

## Type-safety
- [ ] `domGuards.js` is `@ts-check`
- [ ] `number.js` is `@ts-check`
- [ ] Abilities panel CheckJS issue is fixed
- [ ] Broad active-code CheckJS pass is green or honestly documented

## Docs
- [ ] README docs index matches real files
- [ ] Testing docs match actual current test scope
- [ ] Backup/import rollback wording is accurate
- [ ] Deferred items are explicitly dispositioned
- [ ] No stale placeholder review/docs language remains

## Testing
- [ ] Unit/integration tests pass
- [ ] Build passes
- [ ] Verify passes
- [ ] Smoke pass is fresh and truthful
- [ ] Remaining manual-only coverage is documented intentionally

---

# What not to do in this final pass

To keep this release stable, avoid turning closure work into a late-stage rewrite.

Do **not** use this pass to:
- invent a schema-driven tracker renderer
- force a giant abstraction pass across all card renderers
- over-automate every browser/PWA edge
- add broad new feature work
- chase theoretical cleanup that is not tied to integrity, lifecycle, docs truthfulness, or active-code quality

That kind of work belongs in future roadmap planning, not in a closure release.

---

# Definition of done for this closure release

This pass is done when:

- every real integrity issue is fixed
- remaining lifecycle gaps in active Character surfaces are cleaned up
- the small hardening loose ends are closed
- docs fully match reality
- deferred items are explicitly dispositioned
- final verification is green
- you can honestly say the repo has **no unresolved release-quality blockers**

At that point, Lore Ledger becomes what you wanted it to be:

- stable
- thoughtful
- architecturally clean
- boringly reliable
- well-documented
- polished

And then feature work can resume from a clean baseline.
