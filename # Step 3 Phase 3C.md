# Step 3 Phase 3C 
Planning Report Lore Ledger / CampaignTracker

## 1. Executive summary

The `Refactoring` branch already ships a builder-mode foundation (schema 6), a minimal **New Builder Character** flow, an informational badge, a display-only **Builder Summary**, and a small **Builder Identity** editor. Builder characters persist a `build` object with `abilities.base` defaults, and the summary reads derived values via `deriveCharacter()` without persisting them back into flat character fields.

The next slice should enable useful builder functionality while staying safe. Among the candidate directions — ability editing, override strategy design, SRD licensing, subclass groundwork, and UX polish — ability editing delivers the clearest user value while relying on the existing schema. It does not require new content, migrations, field locking, or materialization.

**Recommendation:** Step 3 Phase 3C should add a small **Builder Abilities** editor for builder characters only. It should edit only:

- `build.abilities.base.str`
- `build.abilities.base.dex`
- `build.abilities.base.con`
- `build.abilities.base.int`
- `build.abilities.base.wis`
- `build.abilities.base.cha`

It should not overwrite freeform ability fields, lock fields, materialize derived values, expand the SRD registry, or introduce a full builder wizard.

---

## 2. Recommended Phase 3C slice

Phase 3C should add a **Builder Abilities** panel that lets users manually edit the six base ability scores stored under `build.abilities.base`.

This is the smallest safe implementation slice because:

- The state shape already exists from schema v6.
- New builder characters already have a `build.abilities.base` object.
- `deriveCharacter()` already derives ability totals and modifiers from builder data.
- The existing Builder Summary can show the result without persisting derived values.
- No schema migration is needed.
- No new SRD content is added.
- No field locking or override model is required yet.
- The freeform sheet remains untouched.

This phase should be **manual-score only**. Do not add standard array, point buy, rolled stats, ASI automation, species bonuses, feats, or level-up behavior yet.

---

## 3. Alternatives considered and why not

### Override strategy / field-locking design pass

This is important, but it is not the best Phase 3C implementation slice. Field locking affects many existing panels and risks confusing the boundary between builder-derived fields and freeform fields. It should be designed carefully later, after the app has a few builder-only inputs proving the pattern.

### Content attribution / registry licensing hardening

This is important before expanding the registry, especially before adding subclasses, spells, feats, class features, or richer SRD descriptions. But ability score editing only stores numbers and does not introduce new rules text. A small documentation note is enough for this phase.

### Subclass / level-up groundwork

Subclass and level-up work is too large for the next safe slice. It introduces conditional requirements by class and level, future feature unlocks, choice persistence, and registry expansion. It should wait until the builder can edit base abilities safely.

### Builder panel UX consolidation

Builder panel grouping can wait. With only Identity, Abilities, and Summary, the existing page can support a simple panel sequence without a broader layout overhaul.

### HP / AC / saves / skills / spells automation

These require a mature override and field-locking strategy. They should remain explicitly out of scope.

---

## 4. Exact scope

Phase 3C should include:

1. A new hidden-by-default Builder Abilities panel in `index.html`.
2. A new `builderAbilitiesPanel.js` module.
3. Manual numeric editing for the six base ability scores.
4. Validation that accepts only whole numbers from 1 to 20.
5. Builder-only visibility.
6. Explanatory UI for malformed builder-mode ability data.
7. Summary refresh after valid edits.
8. Tests proving no freeform fields are overwritten.
9. Minimal docs updates to architecture, state schema, and roadmap.

The phase should not change schema version, migration logic, derived-field materialization, linked card behavior, combat behavior, or existing freeform panel behavior.

---

## 5. Explicit non-goals

Phase 3C must not do any of the following:

- No full character builder wizard.
- No field locking.
- No override UI.
- No materialization into flat fields.
- No schema version bump.
- No migration unless an unexpected existing bug requires defensive normalization.
- No subclass flow.
- No level-up flow.
- No HP automation.
- No AC automation.
- No save automation.
- No skill automation.
- No spell automation.
- No combat behavior changes.
- No linked-card behavior changes.
- No custom content support.
- No standard array.
- No point buy.
- No rolled-stat helper.
- No species ability bonuses.
- No ASI or feat support.
- No new SRD content.

---

## 6. UI plan

### Panel shape

Add a new panel directly after Builder Identity and before Builder Summary:

```html
<section class="panel builderAbilitiesPanel" id="charBuilderAbilitiesPanel" hidden aria-hidden="true">
  <div class="panelHeader">
    <h2 id="charBuilderAbilitiesTitle">Builder Abilities</h2>
  </div>

  <p class="builderAbilitiesNote">
    Edit the builder base ability scores used by Builder Summary. These do not overwrite the freeform ability fields below.
  </p>

  <div class="builderAbilitiesGrid">
    <!-- six labelled number controls -->
  </div>
</section>
```

Each control should have an explicit label. Use the same accessibility discipline from Phase 3B:

- Visible label text.
- Input associated through `aria-labelledby` or a proper `<label for="...">` relationship.
- No placeholder-only labels.
- Keyboard-friendly number inputs.

### Ability controls

Recommended IDs:

- `charBuilderAbilityStr`
- `charBuilderAbilityDex`
- `charBuilderAbilityCon`
- `charBuilderAbilityInt`
- `charBuilderAbilityWis`
- `charBuilderAbilityCha`

Recommended constraints:

```html
<input type="number" min="1" max="20" step="1" inputmode="numeric">
```

### Messaging

The panel should clearly say that builder ability scores update the Builder Summary only and do not overwrite freeform sheet fields. This avoids the largest UX risk: users thinking the app has two competing ability score editors for the same persisted values.

### Mobile layout

Use a compact responsive grid:

- Desktop/tablet: 2 or 3 columns.
- Mobile: 1 column or 2 tight columns if the existing panel style supports it cleanly.
- Avoid horizontal overflow.
- Reuse existing form spacing and input styling rather than inventing a new visual language.

---

## 7. Data-flow plan

### Source of truth

For Phase 3C, the source of truth is only:

```js
character.build.abilities.base
```

Do not read from or write to the flat/freeform ability fields for this panel.

### Update path

Each valid input change should call the existing state action helper:

```js
updateCharacterField("build.abilities.base.str", value, { queueSave: false })
```

Repeat for each key.

After a successful update:

1. Mark dirty through the same save lifecycle pattern used by Builder Identity.
2. Notify panel invalidation so Builder Summary refreshes.
3. Refresh the Builder Abilities panel controls from state.

### Validation

Use a small validator:

```js
function normalizeAbilityScore(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value)) return null;
  if (value < 1 || value > 20) return null;
  return value;
}
```

Invalid values should no-op and reset the control to the current state value. Do not coerce blank or invalid values to 10, and do not default invalid values to 1. This follows the Phase 3B polish principle: invalid input should not silently create meaningful data.

### Malformed builder data

If a strict builder character has malformed ability shape, show explanatory UI and do not make the panel editable. This should mirror the Phase 3B pattern for malformed identity data.

Examples of malformed cases:

- `build.abilities` missing.
- `build.abilities.base` missing.
- `build.abilities.base` is not an object.
- One or more ability keys missing or non-numeric.

For this phase, the safest behavior is **not editable** rather than trying to repair shape during render. If defensive repair is later desired, it should be a separate, intentional state-normalization slice.

### Avoid materialization

Do not call:

```js
materializeDerivedCharacterFields()
```

Builder Summary remains display-only. Flat fields remain user-editable and separate.

---

## 8. Content registry / SRD attribution plan

Phase 3C does not need to expand SRD content. Ability scores are numeric values, and editing them does not add rules text, class features, spells, feats, monsters, or descriptions.

Still, this is a good moment for a small documentation note:

- Existing built-in registry content should remain limited to the current small SRD-safe set.
- This phase should not add subclasses, spells, feats, or descriptive SRD text.
- Before expanding registry content, add a dedicated attribution/content-boundary pass.

This is not legal advice. It is a practical implementation-risk note: keep Phase 3C numeric-only and avoid increasing licensing surface area in the same slice.

---

## 9. Exact files likely to change

### `index.html`

Add the `#charBuilderAbilitiesPanel` section between Builder Identity and Builder Summary.

Do not alter existing freeform ability inputs.

### `js/pages/character/panels/builderAbilitiesPanel.js`

Create a new panel module responsible for:

- Finding panel DOM anchors.
- Determining active builder character.
- Validating `build.abilities.base` shape.
- Syncing six inputs from state.
- Writing valid updates through `updateCharacterField()`.
- Triggering panel invalidation for summary refresh.
- Handling active-character changes.
- Returning a no-op-safe destroy API.

Do not import or call materialization helpers.

### `js/pages/character/characterPage.js`

Import and initialize the new panel alongside the existing builder panels.

Do not refactor the full page initialization.

### `styles.css`

Add minimal styles for:

- `.builderAbilitiesPanel`
- `.builderAbilitiesGrid`
- `.builderAbilitiesNote`

Reuse existing visual patterns. Do not redesign the character page.

### `tests/characterPage.test.js`

Add or extend tests for panel visibility, editing, validation, summary refresh, freeform preservation, malformed builder data, active-character switching, and accessibility labels.

### `tests/rulesEngine.test.js`

Likely only add focused coverage if current tests do not already prove ability derivation from `build.abilities.base`. This should not become a UI test file.

### `tests/characterHelpers.test.js`

Likely unchanged unless the implementation adds a new helper for builder ability editability.

### `tests/state.characters.test.js`

Add state-level regression coverage only if helpful to prove nested builder ability updates do not overwrite flat fields.

### `NEW-FEATURES-ROADMAP.md`

Add Phase 3C as completed or in-progress once implemented.

### `docs/architecture.md`

Update the builder/rules-engine section to mention the Builder Abilities panel and the no-materialization boundary.

### `docs/state-schema.md`

Clarify that `build.abilities.base` is user-editable in builder mode and remains separate from legacy/freeform ability fields.

---

## 10. Tests to add/update

### Freeform preservation

Test that a freeform character with `build: null`:

- Does not show Builder Abilities.
- Keeps the existing freeform Abilities & Skills panel behavior.
- Does not gain a `build` object through render or panel initialization.

### Builder-only UI visibility

Test that the Builder Abilities panel:

- Appears for strict builder characters.
- Is hidden for freeform characters.
- Is hidden or explanatory-only for malformed builder data.

### Default values

Test that a new builder character shows all six base abilities as 10.

### Valid editing

Test editing one or more ability inputs:

- `str` from 10 to 15.
- `dex` from 10 to 14.

Assert state updates only these paths:

- `build.abilities.base.str`
- `build.abilities.base.dex`

### No flat-field overwrite

If the flat/freeform ability fields have values, editing builder abilities must not change them.

### No materialization

After ability edits, assert the character does not receive derived flat values from `materializeDerivedCharacterFields()`.

### No field locking

Test that the existing freeform ability controls remain enabled/editable.

### Invalid value handling

Test that these inputs no-op and reset to current state:

- Blank value.
- Non-number.
- `0`.
- `21`.
- Decimal value such as `12.5`.

### Summary refresh after edits

After editing an ability score, assert Builder Summary displays the new total/modifier.

Example:

- Set Strength to 15.
- Summary should show Strength 15 and modifier +2 if summary displays modifiers.

### Active-character switch behavior

Create two builder characters with different ability scores. Switch active character and assert inputs resync to the selected character.

### Accessibility

Assert each input is discoverable by accessible name:

- Strength
- Dexterity
- Constitution
- Intelligence
- Wisdom
- Charisma

---

## 11. Docs to update

Keep docs minimal and factual.

### `NEW-FEATURES-ROADMAP.md`

Add a short Step 3 progress bullet:

- Phase 3C: Builder Abilities editor — manual base ability editing for builder characters.

### `docs/state-schema.md`

Under schema v6 / character builder fields, add:

- `build.abilities.base` is editable through Builder Abilities.
- It stores manual base scores only.
- It does not overwrite flat/freeform ability fields.
- Derived totals remain display-only.

### `docs/architecture.md`

Under rules engine / character builder architecture, add:

- Builder Identity edits identity choices.
- Builder Abilities edits manual base ability scores.
- Builder Summary derives display-only values.
- Runtime does not materialize derived values into canonical sheet fields.

No broad README rewrite is needed for this small slice.

---

## 12. Risks and mitigations

### Risk: duplicate sources of truth

The app will have builder ability values and existing freeform ability fields. This is acceptable only if the UI is explicit.

**Mitigation:** The Builder Abilities panel must say the values update Builder Summary only and do not overwrite sheet fields.

### Risk: accidental flat-field overwrite

A careless implementation could update the existing freeform ability paths.

**Mitigation:** Write only to `build.abilities.base.<key>`. Add tests that flat fields do not change.

### Risk: hidden materialization

Calling `materializeDerivedCharacterFields()` would blur the current architectural boundary.

**Mitigation:** Do not import it. Add tests that derived values are not persisted into flat fields.

### Risk: mutation during render

Trying to repair malformed build shape during render could mutate state unexpectedly.

**Mitigation:** Treat malformed build data as explanatory-only in this phase.

### Risk: Phase 3C becomes a hidden wizard

Ability editing could tempt addition of standard array, point buy, and ASI logic.

**Mitigation:** Manual scores only. No methods, no automation, no builder stepper.

### Risk: SRD/content scope creep

Adding ability editing could tempt content expansion.

**Mitigation:** No new SRD content in Phase 3C. Save attribution/legal hardening for a dedicated pass before registry expansion.

### Risk: mobile layout regressions

Six new numeric inputs can overflow if styled poorly.

**Mitigation:** Use responsive grid and existing form styles; test narrow viewport behavior.

---

## 13. Recommended Codex implementation prompt

```text
Agent mode / Codex

You are implementing Step 3 Phase 3C for the Lore Ledger / CampaignTracker repo.

Repository:
Lrmann818/CampaignTracker

Branch:
Refactoring

Use the connected GitHub repository access directly if available.
Do not use browser ZIP download unless direct GitHub repository access is unavailable.

Use the latest pushed Refactoring branch as source of truth, not main.

Goal:
Add the smallest safe Builder Abilities editor for builder-mode characters.

Context:
Step 3 completed work includes:
- Phase 1: schema v6 + pure rules-engine foundation
- Phase 1.1: shared override normalization + stricter builder detection
- Phase 2: minimal “New Builder Character” creation path
- Phase 2 polish: accessible informational Builder Mode badge
- Phase 3A: display-only Builder Summary panel
- Phase 3B: minimal Builder Identity editor
- Phase 3B must-fix polish: complete and reviewed/approved

Current facts:
- CURRENT_SCHEMA_VERSION is 6.
- Freeform characters use build: null.
- Builder characters have a build object.
- Builder Identity edits only build.speciesId, build.classId, build.backgroundId, and build.level.
- Builder Summary is display-only and does not persist derived values.
- deriveCharacter() is pure.
- materializeDerivedCharacterFields() exists but is not wired into runtime.
- No field locking exists yet.
- No override UI exists yet.
- No ability editing exists yet.

Task:
Implement Phase 3C as a manual Builder Abilities editor.

Scope:
- Add a new Builder Abilities panel for builder characters only.
- The panel edits only:
  - build.abilities.base.str
  - build.abilities.base.dex
  - build.abilities.base.con
  - build.abilities.base.int
  - build.abilities.base.wis
  - build.abilities.base.cha
- Accept only integer values from 1 to 20.
- Invalid, blank, non-numeric, decimal, below-range, and above-range values must be no-ops and must not silently default to another score.
- The panel must refresh Builder Summary after valid edits.
- The panel must not overwrite existing flat/freeform ability fields.
- Freeform characters must remain unchanged and must not gain build data through render/init.
- Malformed builder ability shape should show explanatory non-editable UI rather than mutating state during render.

Non-goals:
- No full builder wizard.
- No standard array.
- No point buy.
- No rolled stat helper.
- No species bonuses.
- No ASI or feat support.
- No subclass flow.
- No level-up flow.
- No HP/AC/saves/skills/spell automation.
- No field locking.
- No override UI.
- No materialization.
- No schema change.
- No migration.
- No linked-card changes.
- No combat changes.
- No custom content.
- No new SRD content.

Files to inspect first:
- js/domain/characterHelpers.js
- js/domain/rules/builtinContent.js
- js/domain/rules/registry.js
- js/domain/rules/deriveCharacter.js
- js/pages/character/characterPage.js
- js/pages/character/panels/builderIdentityPanel.js
- js/pages/character/panels/builderSummaryPanel.js
- js/pages/character/panels/abilitiesPanel.js
- index.html
- styles.css
- tests/characterPage.test.js
- tests/rulesEngine.test.js
- tests/characterHelpers.test.js
- tests/state.characters.test.js
- NEW-FEATURES-ROADMAP.md
- docs/architecture.md
- docs/state-schema.md

Implementation requirements:

1. index.html
- Add #charBuilderAbilitiesPanel after #charBuilderIdentityPanel and before #charBuilderSummaryPanel.
- Hidden by default with hidden and aria-hidden="true".
- Add a heading: Builder Abilities.
- Add an explanatory note that these scores update Builder Summary and do not overwrite freeform sheet fields.
- Add six labelled number inputs with accessible labels for Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma.
- Use min="1", max="20", step="1", and inputmode="numeric".

2. New module
Create js/pages/character/panels/builderAbilitiesPanel.js.
Follow the production style of builderIdentityPanel.js:
- Safe no-op if required deps or DOM anchors are missing.
- Resolve active character via getActiveCharacter/state helpers.
- Only show editable controls for strict builder characters with valid build.abilities.base shape.
- Use createStateActions(state) and updateCharacterField for nested writes.
- Do not mutate state during render.
- Do not import or call materializeDerivedCharacterFields().
- On valid update, mark dirty and notify panel invalidation so Builder Summary refreshes.
- Listen for active character changes and panel invalidation.
- Return a destroy method that cleans up listeners.

3. characterPage.js
- Import and initialize initBuilderAbilitiesPanel with the same dependency pattern as the existing builder panels.
- Keep initialization order aligned with visual order: identity, abilities, summary.
- Do not refactor unrelated character page logic.

4. styles.css
- Add minimal responsive styles for the panel and grid.
- Reuse existing builder panel visual language.
- Avoid horizontal overflow on mobile.

5. Tests
Add tests covering:
- Freeform preservation: freeform characters do not show Builder Abilities and do not gain build data.
- Builder-only visibility.
- Default builder ability values are 10.
- Valid edits update build.abilities.base only.
- Invalid values no-op and reset to current state.
- Existing flat/freeform ability fields are not overwritten.
- No derived fields are materialized into flat fields.
- No field locking is introduced; freeform ability controls remain editable.
- Malformed builder ability data shows explanatory non-editable UI.
- Builder Summary refreshes after valid ability edits.
- Active-character switching resyncs the six controls.
- Ability inputs have accessible labels.

6. Docs
Update only what is necessary:
- NEW-FEATURES-ROADMAP.md: add Phase 3C Builder Abilities progress.
- docs/state-schema.md: note build.abilities.base is now editable through Builder Abilities and remains separate from flat/freeform ability fields.
- docs/architecture.md: note Builder Abilities panel writes builder metadata only; Builder Summary remains display-only; no materialization.

Verification commands:
- npm run typecheck
- npm run test:run
- npm run build
- git diff --check

Output report after implementation:
1. Executive summary
2. Exact files changed
3. What was implemented
4. Explicit non-goals preserved
5. Tests added/updated
6. Verification results with command output summary
7. Risks / follow-up recommendations
```
