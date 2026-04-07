# Lore Ledger Final Remaining Closure Plan (Repo-Aligned)

This plan is the **updated, repo-aligned version** of the earlier `final-closure-plan-v0.5.0.md`.

It is based on the current public repo state on `main`, after the live-site bug fixes. It is meant to reflect **what still appears open now**, not what used to be open earlier.

## Purpose

This is a **remaining-work closure plan**, not a ground-up hardening roadmap.

The goal is to finish the last meaningful release-quality cleanup so the repo can honestly be described as:

- stable
- boringly reliable
- well-documented
- review-ready
- free of unresolved release-quality blockers

---

## What appears already in good shape

These areas look materially solid enough that they do **not** need to stay as major closure work items:

- single composition root and repo structure
- tracker panel instance-scoped controller direction
- overall persistence/migration hardening direction
- targeted test/build verification workflow
- docs set existing under `docs/`
- packaging / GitHub Pages / PWA baseline

This updated plan focuses only on the items that still look meaningfully open in the current repo.

---

# Remaining closure priorities

## Priority 1 — Fix destructive asset deletion ordering

### Why this is still open
Current destructive delete/remove flows still appear to delete blob-backed assets **before** the related structured state mutation is durably committed.

That means a later save/commit failure could leave the app with structured state that still expects assets that were already deleted.

### Areas to fix
- tracker NPC delete flow
- tracker Party delete flow
- tracker Location delete flow
- map background removal flow
- map deletion flow

### Done looks like
All destructive flows follow the same integrity model already used by safer replacement paths:

1. stage state change
2. durably save/commit structured state
3. only then delete old blob(s)
4. rollback safely on failure

### Codex prompt
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
- Based on the current repo, this includes tracker card delete flows and map background/map deletion flows.
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

### Suggested commit
```bash
git commit -m "Harden destructive asset deletion ordering"
```

---

## Priority 2 — Verify and close backup import text rollback safety

### Why this is still open
This item should be treated as **verify-and-close**, not blindly assumed done.

The repo’s overall backup/rollback story is much stronger than before, but this specific edge still deserves one direct confirmation pass:

- if import writes text records before final commit
- and import fails after those writes begin
- existing stored text data must not be silently overwritten

### Done looks like
- either text writes are staged until commit, or
- prior text records are fully restorable on failure
- tests prove collision + rollback behavior explicitly
- docs describe this accurately

### Codex prompt
```text
You are working in the Lore Ledger repo.

Goal:
Verify and, if needed, harden backup import so text staging/writes are rollback-safe, not just blob staging.

Problem to solve:
The current repo/docs suggest backup rollback is strong, but this specific text-overwrite edge still needs explicit confirmation. Because text storage uses put-by-id semantics, a failed import may still risk overwriting existing text records unless that path is staged or rollback-safe.

Requirements:
- Inspect js/storage/backup.js and js/storage/texts-idb.js.
- Determine whether text writes during import are already safely staged or fully rollback-safe.
- If they are not, implement the smallest production-grade fix.
- Add focused tests for:
  - text ID collision during import
  - failed import after text writes begin
  - rollback restores previous text data correctly
  - successful import still commits correctly
- Update docs if wording currently overstates coverage.

Acceptance criteria:
- A failed import cannot silently overwrite prior text records.
- The final behavior is explicitly test-covered.
- Docs match the actual behavior.
- Output:
  1) whether the issue was already closed or needed code changes
  2) files changed
  3) tests added/updated
  4) verification results
```

### Suggested commit
```bash
git commit -m "Verify and harden backup text import rollback safety"
```

---

## Priority 3 — Finish Character lifecycle parity

### Why this is still open
The Character page is in better shape than before, but the older panels still look like the main remaining lifecycle gap.

The goal here is not a grand rewrite.  
The goal is to bring the last older Character surfaces up to the same standard of:

- instance-scoped ownership
- explicit destroy/cleanup
- no stale re-init behavior
- no duplicate event binding
- no dataset-guard hacks standing in for lifecycle control

---

### Step 3A. Attack panel cleanup
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

Suggested commit:
```bash
git commit -m "Bring attack panel to explicit lifecycle cleanup standard"
```

---

### Step 3B. Vitals panel cleanup
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

Suggested commit:
```bash
git commit -m "Bring vitals panel to explicit lifecycle cleanup standard"
```

---

### Step 3C. Abilities panel cleanup + CheckJS cleanup
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

Suggested commit:
```bash
git commit -m "Finish abilities panel lifecycle and CheckJS cleanup"
```

---

## Priority 4 — Close the remaining active-code CheckJS gaps

### Why this is still open
The repo docs still describe the CheckJS story as intentionally narrower than full repo-wide coverage. That is honest, but if the goal is true closure, this is the right time to push the active/shared code surfaces as far as practical.

### Scope
- focus on active/shared code
- no fake “green” via suppressions
- no giant leaf-module crusade unless the failures are still real and in-use

### Codex prompt
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

Suggested commit:
```bash
git commit -m "Close remaining active-code CheckJS gaps"
```

---

## Priority 5 — Close the smaller hardening loose ends

These are not the biggest risks, but they are still worthwhile closure items because they remove the last “known paper-cut” issues.

---

### Step 5A. Consolidate `hitDieAmount` normalization
Keep migration as the single canonical normalization point unless testing proves the save path still truly needs a defensive duplicate.

```text
You are working in the Lore Ledger repo.

Goal:
Consolidate hitDieAmount -> hitDieAmt normalization so there is a single canonical normalization point, without weakening save safety.

Context:
Current repo still appears to normalize this alias in more than one place.

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

Suggested commit:
```bash
git commit -m "Canonicalize hit-die alias normalization in migration"
```

---

### Step 5B. Remove the `applyTextareaSize` boot-order footgun
This is a small defensive hardening pass.

```text
You are working in the Lore Ledger repo.

Goal:
Remove the latent boot-order footgun around applyTextareaSize dependency capture in tracker page dependency assembly.

Context:
Current repo still appears to rely on boot ordering for applyTextareaSize availability.

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

Suggested commit:
```bash
git commit -m "Harden tracker textarea sizing dependency lookup"
```

---

### Step 5C. Add `@ts-check` to the remaining lightweight utility gaps
This is still a good quick-win closure step if those modules are not already covered by the time you reach this step.

```text
You are working in the Lore Ledger repo.

Goal:
Close the small shared-utility typing gaps by adding // @ts-check to the remaining lightweight utility modules called out in review.

Target:
- js/utils/domGuards.js
- js/utils/number.js

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

Suggested commit:
```bash
git commit -m "Add ts-check to shared utility modules"
```

---

## Priority 6 — Finish docs truthfulness and disposition

### Why this is still open
The repo still contains placeholder-style docs index entries. For a true closure pass, the documentation should stop implying unresolved “planned docs” work unless those are genuinely being kept as roadmap items on purpose.

### Goals
- remove stale placeholder/doc-index drift
- make backup/import wording exactly truthful
- convert fuzzy deferred items into explicit product decisions

---

### Step 6A. Final docs truthfulness pass
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
- Remove placeholder links/docs that do not exist, or clearly mark them as roadmap-only if intentionally retained.
- Make the docs index reflect the actual current document set.
- Update wording anywhere backup import safety is overstated.
- Keep docs concise, accurate, and aligned with current architecture/tests.
- Do not invent new docs unless needed to replace a broken placeholder with a real current document.

Acceptance criteria:
- README and review-facing docs are internally consistent and truthful.
- No misleading placeholder references remain.
- Output exact files updated and a brief summary of wording changes.
```

Suggested commit:
```bash
git commit -m "Tighten docs for final review readiness"
```

---

### Step 6B. Explicitly disposition deferred items
This is how you get to “nothing left on the vague todo list” without forcing unnecessary late-stage rewrites.

```text
You are working in the Lore Ledger repo.

Goal:
Eliminate ambiguous deferred-work language from the repo by converting remaining “intentionally deferred” items into explicit dispositioned decisions.

Requirements:
- Review the current architecture/testing/review docs for items described as intentionally deferred, nice-to-have later, future work, or known gaps.
- For each item, choose one of:
  1) done now
  2) intentionally out of scope for this app/version
  3) future roadmap item, not release-quality debt
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

Suggested commit:
```bash
git commit -m "Disposition deferred items explicitly"
```

---

## Priority 7 — Final smoke coverage closure

### Why this still matters
Some remaining review gaps are test-scope gaps rather than code bugs. If you want a true closure pass, either automate the highest-value missing flows or explicitly document that they remain manual by design.

### Codex prompt
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

Suggested commit:
```bash
git commit -m "Expand final high-value smoke coverage"
```

---

# Recommended execution order

1. destructive asset deletion ordering
2. backup text rollback verify-and-close
3. attack panel cleanup
4. vitals panel cleanup
5. abilities panel cleanup + CheckJS cleanup
6. final active-code CheckJS pass
7. `hitDieAmount` normalization cleanup
8. `applyTextareaSize` hardening
9. `domGuards.js` + `number.js` `@ts-check`
10. docs truthfulness pass
11. deferred-item disposition pass
12. final smoke coverage closure

---

# Final verification pass

When all remaining steps are done, run a truthful fresh verification pass:

```bash
npm test
npm run build
npm run verify
npm run test:smoke
```

If smoke fails because of local environment issues like a port conflict, resolve that and rerun so the final closure result is real.

---

# Definition of done

This closure pass is done when:

- destructive asset deletion is safe
- backup text import rollback is explicitly verified safe
- remaining active Character lifecycle gaps are closed
- meaningful active-code CheckJS gaps are closed
- small hardening loose ends are closed
- docs fully match reality
- deferred items are explicitly dispositioned
- verification is green
- you can honestly say there are **no unresolved release-quality blockers left**

At that point, Lore Ledger is on the cleanest possible baseline for either:
- a final polish/review pass, or
- starting the next feature cycle from a genuinely hardened foundation
