# Lore Ledger Closure Branch / Commit Tracker

Use this file as the **working execution tracker** for the remaining closure pass.

Recommended branch:

```bash
git checkout -b final-closure-v0.5.0
```

---

## Working rules

- Keep each step commit-sized.
- Do not broaden scope mid-step.
- Preserve user-visible behavior unless correctness requires change.
- No `@ts-nocheck`.
- No blanket suppressions.
- End each step with:
  - files changed
  - tests updated
  - verification commands run
  - results

---

# Branch status

- [N] Branch created: `final-closure-v0.5.0`
  - work is being done in 'Refactoring' instead
- [Y] Working tree clean before starting
- [Y] Baseline verification run recorded

Baseline commands:

```bash
npm test
npm run build
npm run verify
npm run test:smoke
```

Notes:
- FIRST RUN:
- Baseline verification on Refactoring branch:

- git status: clean
- npm test: PASS (11 files, 80 tests)
- npm run build: PASS
- npm run verify: PASS
- npm run test:smoke: FAIL

Smoke failures:
- tests/smoke/dropdownRegression.smoke.js
  1) card-level tracker dropdowns open and stay wired after rerender
     - expected open dropdown menu count to return to 0
     - received 1
  2) card-level tracker dropdown options stay clickable in the body-ported card menu path
     - expected NPC card count to become 0 after delete path
     - received 1

Interpretation:
- unit/integration/build baseline is healthy
- remaining regression is concentrated in tracker dropdown/card-menu behavior
- start closure work there first

- NEXT & LAST RUN:
- Baseline verification recorded on Refactoring branch.

Results:
- npm test: PASS
- npm run build: PASS
- npm run verify: PASS
- npm run test:smoke: PASS

Additional targeted regression verification:
- npm run test:smoke -- dropdownRegression.smoke.js: PASS
- npm run test:smoke -- dropdownRegression.smoke.js --repeat-each=10: PASS

Notes:
- stderr output during vitest was expected from failure-path/rollback tests.
- Earlier smoke regression was fixed in shared dropdown/popover lifecycle code.
- Current baseline is green and suitable for starting the remaining closure steps.

---

# Commit tracker

## 1) Destructive asset deletion ordering
**Goal:** make delete/remove flows save-first and delete-after-commit safe.

- [ ] Prompt run
- [ ] Code reviewed
- [ ] Tests added/updated
- [ ] `npm test` passed
- [ ] `npm run build` passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Harden destructive asset deletion ordering"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 2) Backup text import rollback verify-and-close
**Goal:** verify whether the text overwrite edge is already closed; if not, fix it.

- [ ] Prompt run
- [ ] Verified whether bug was already closed
- [ ] Code changed if needed
- [ ] Tests added/updated
- [ ] Docs updated if needed
- [ ] Verification passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Verify and harden backup text import rollback safety"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 3) Attack panel lifecycle cleanup
**Goal:** remove stale re-init / duplicate binding risk.

- [ ] Prompt run
- [ ] Lifecycle cleanup complete
- [ ] Coverage added/updated
- [ ] Verification passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Bring attack panel to explicit lifecycle cleanup standard"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 4) Vitals panel lifecycle cleanup
**Goal:** bring vitals panel to explicit teardown ownership.

- [ ] Prompt run
- [ ] Lifecycle cleanup complete
- [ ] Coverage added/updated
- [ ] Verification passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Bring vitals panel to explicit lifecycle cleanup standard"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 5) Abilities panel lifecycle + CheckJS cleanup
**Goal:** make abilities panel lifecycle-safe and clear its active CheckJS failure(s).

- [ ] Prompt run
- [ ] Lifecycle cleanup complete
- [ ] CheckJS issues fixed
- [ ] Coverage added/updated
- [ ] Verification passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Finish abilities panel lifecycle and CheckJS cleanup"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 6) Final active-code CheckJS pass
**Goal:** close meaningful remaining type-check failures in active/shared code.

- [ ] Prompt run
- [ ] Broad CheckJS command run
- [ ] Remaining failures triaged
- [ ] Real active-code issues fixed
- [ ] Any tiny exclusions documented honestly
- [ ] Verification passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Close remaining active-code CheckJS gaps"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 7) `hitDieAmount` normalization cleanup
**Goal:** make migration the one canonical normalization point.

- [ ] Prompt run
- [ ] Duplicate normalization removed if safe
- [ ] Dev guard added if needed
- [ ] Tests updated
- [ ] Verification passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Canonicalize hit-die alias normalization in migration"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 8) `applyTextareaSize` hardening
**Goal:** remove boot-order fragility from tracker dependency assembly.

- [ ] Prompt run
- [ ] Hardening change complete
- [ ] Behavior preserved
- [ ] Verification passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Harden tracker textarea sizing dependency lookup"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 9) `domGuards.js` + `number.js` `@ts-check`
**Goal:** close remaining lightweight shared utility typing gaps.

- [ ] Prompt run
- [ ] `domGuards.js` updated
- [ ] `number.js` updated
- [ ] JSDoc added as needed
- [ ] Verification passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Add ts-check to shared utility modules"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 10) Docs truthfulness pass
**Goal:** make README/testing/review-facing docs fully match reality.

- [ ] Prompt run
- [ ] Docs index corrected
- [ ] Backup/import wording corrected
- [ ] Placeholder or misleading references removed/dispositioned
- [ ] Verification passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Tighten docs for final review readiness"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 11) Deferred-item disposition pass
**Goal:** convert fuzzy deferred work into explicit decisions.

- [ ] Prompt run
- [ ] Deferred items reviewed
- [ ] Out-of-scope vs roadmap decisions recorded
- [ ] Docs updated
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Disposition deferred items explicitly"
```

Files / notes:
- __________________________________________
- __________________________________________

---

## 12) Final smoke coverage closure
**Goal:** add only the highest-value remaining smoke coverage and document the rest as manual by design.

- [ ] Prompt run
- [ ] New smoke cases added
- [ ] Testing docs updated
- [ ] `npm run test:smoke` passed
- [ ] Commit created

Suggested commit:

```bash
git commit -m "Expand final high-value smoke coverage"
```

Files / notes:
- __________________________________________
- __________________________________________

---

# Final verification checklist

## Commands
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run verify`
- [ ] `npm run test:smoke`

## Release-quality closure checks
- [ ] Destructive asset deletion is safe
- [ ] Backup text import rollback is explicitly verified safe
- [ ] Remaining Character lifecycle gaps are closed
- [ ] Meaningful active-code CheckJS gaps are closed
- [ ] Small hardening loose ends are closed
- [ ] Docs fully match reality
- [ ] Deferred items are explicitly dispositioned
- [ ] Final smoke result is fresh and truthful

---

# Final branch wrap-up

- [ ] Final review pass requested
- [ ] Final changes merged/cherry-picked as desired
- [ ] Versioning decision made
- [ ] Release tag prepared if applicable

Final notes:
- __________________________________________
- __________________________________________
- __________________________________________
