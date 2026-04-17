# Step 3 Phase 3F: Builder-Derived Basics Display

## 1. Executive Summary

The best next small slice is **builder-derived identity display in the normal Basics panel**: for builder characters, `charClassLevel`, `charRace`, and `charBackground` should display values from `deriveCharacter(...)` instead of persisted flat fields, without materializing those values back into `classLevel`, `race`, or `background`.

This is the cleanest next move after Phase 3E because the derivation already exists, Builder Identity already owns the editable source fields, and Builder Summary already proves the expected labels. It advances the product direction that the normal sheet becomes the primary builder surface while avoiding HP/AC rules that are not defined yet.

## 2. Best Next Slice

Implement **Basics display integration only**:

- Builder characters:
  - `charClassLevel` displays derived class/level, for example `Fighter 5`.
  - `charRace` displays derived species label, using the existing field even though the builder term is species.
  - `charBackground` displays derived background label.
  - These three fields are read-only / builder-owned for now.
  - Editing is still done through temporary Builder Identity scaffolding.
  - Flat fields are not changed.
- Freeform characters:
  - Existing Basics behavior remains unchanged.
  - `classLevel`, `race`, and `background` remain editable flat fields.

Do not include HP, AC, speed, hit dice, spell attack/DC, saves, skills, or proficiency in this slice.

## 3. Why This Is Safest / Highest Value

This slice is high-value because it removes the most obvious split-brain UI: Builder Identity and Builder Summary know the character is a Fighter/Human/Soldier, while the normal Basics panel can still show stale freeform text.

It is safe because `deriveCharacter(...)` already returns the needed labels, and this work can stay display-only with no schema change, no migration, no new builder content model, and no materialization. It also gives a clear precedent for later Vitals integration: builder-owned values appear on the normal sheet, while temporary builder panels remain as editing scaffolding.

## 4. Exact Files Likely To Change

Likely implementation files:

- [basicsPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/basicsPanel.js)
- [index.html](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/index.html) for stale Builder Identity copy that currently says existing sheet fields remain editable
- [characterPanels.activeCharacter.test.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/tests/characterPanels.activeCharacter.test.js)
- [characterPage.test.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/tests/characterPage.test.js)
- [architecture.md](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/docs/architecture.md)
- [state-schema.md](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/docs/state-schema.md)
- [NEW-FEATURES-ROADMAP.md](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/NEW-FEATURES-ROADMAP.md)

Likely no code changes needed in:

- [deriveCharacter.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/rules/deriveCharacter.js)
- [characterHelpers.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/characterHelpers.js)
- [builderIdentityPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/builderIdentityPanel.js)
- [builderSummaryPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/builderSummaryPanel.js)
- [vitalsPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/vitalsPanel.js)

## 5. Basics Before HP/AC?

Yes. Basics display integration should come before HP/AC.

Basics uses already-derived identity labels. HP and AC need rule decisions that are not present yet: HP method, class hit die policy, Constitution interaction, level-up behavior, armor/equipment modeling, shields, Dexterity caps, override paths, and combat-linked behavior.

## 6. Proficiency Bonus: Same Slice Or Separate?

Separate it.

Proficiency is already derivable, but it lives in Vitals and has a hidden dependency with Abilities/Skills: `abilitiesPanel.js` reads `#charProf` for save and skill calculations. Making `charProf` builder-owned safely probably requires changes in Vitals plus a careful review of Abilities/Skills recalculation order and combat embedded Vitals.

Recommended sequence:

1. Phase 3F: Basics identity display only.
2. Phase 3G: Builder-derived proficiency display in Vitals, with Abilities/Skills reading builder proficiency directly or otherwise avoiding stale DOM ordering.
3. Later: HP/AC derivation.

## 7. Blockers Before Builder-Aware HP Or AC

- `deriveCharacter(...)` does not currently return HP or AC.
- Builtin content has class `hitDie` and species `speed`, but no HP policy.
- No chosen HP model: fixed average, rolled HP, manual per-level HP, or max-at-level-1 plus average later.
- No armor/equipment model for AC: no equipped armor, shield state, armor type, Dex cap, unarmored defense, natural armor, or magic bonus structure.
- No HP/AC override schema exists.
- Vitals currently writes flat `hpMax`, `ac`, `speed`, etc. directly.
- Combat embedded Vitals is a live alternate view of the same fields, so builder-aware HP/AC affects both Character and Combat surfaces.
- Linked combat/tracker HP flows must not be confused with derived max HP.

## 8. Risks And Hidden Scope Traps

- `bindText` currently marks dirty on every input event, so builder-owned Basics fields may need custom binding rather than the existing helper.
- `deriveCharacter().labels.classLevel` can be just `"1"` when no class is selected; Basics should not show a bare level as if it were a class.
- The existing Builder Identity note says sheet fields remain editable; that becomes stale.
- Tests currently assert that builder Basics fields remain editable; those tests should be intentionally updated for class/race/background only.
- Do not rename `race` schema or DOM IDs to species in this slice.
- Avoid making Basics edit `build.speciesId`, `build.classId`, or `build.backgroundId`; the normal text fields are not pickers.
- Refresh must respond to Builder Identity changes through the existing `character-fields` invalidation.
- Do not call `materializeDerivedCharacterFields(...)`.

## 9. Recommended Non-Goals

- No schema version change.
- No migration.
- No HP, AC, speed, hit dice, spell attack/DC, saves, skills, spells, attacks, proficiencies, or combat automation.
- No label override system for class/species/background.
- No removal or hiding of Builder Identity, Builder Abilities, or Builder Summary.
- No custom content expansion.
- No full builder wizard or level-up flow.
- No writes to `classLevel`, `race`, or `background` for builder characters.

## 10. Draft Implementation Prompt

Implement Step 3 Phase 3F in the Lore Ledger / CampaignTracker repo on the current local `Refactoring` branch.

This is a narrow builder Basics display slice. Do not implement HP, AC, proficiency, saves, skills, spells, attacks, custom content, schema migration, or the full builder wizard.

Requirements:

- In `basicsPanel.js`, make `charClassLevel`, `charRace`, and `charBackground` builder-aware.
- For freeform characters, preserve current behavior exactly: those fields read/write `classLevel`, `race`, and `background`.
- For builder characters, display labels from `deriveCharacter(getActiveCharacter(state))`:
  - `charClassLevel`: show a real class/level label such as `Fighter 5`; if no class is selected and the derived label is only the numeric level, show blank.
  - `charRace`: show the derived species label.
  - `charBackground`: show the derived background label.
- For builder characters, make those three fields read-only / builder-owned and prevent input events from mutating flat fields or marking the save dirty.
- Keep `charName`, `charAlignment`, `charExperience`, `charFeatures`, and portrait behavior unchanged for builder and freeform characters.
- When Builder Identity changes `build.speciesId`, `build.classId`, `build.backgroundId`, or `build.level`, the normal Basics fields must refresh from derivation through existing invalidation.
- Do not write derived labels into `classLevel`, `race`, or `background`.
- Do not use `materializeDerivedCharacterFields(...)`.
- Update stale Builder Identity user-facing copy in `index.html` so it no longer claims existing sheet identity fields remain editable.
- Add or update tests proving:
  - builder Basics displays derived class/species/background values;
  - Builder Identity edits refresh the normal Basics display;
  - attempting to edit builder-owned Basics identity fields does not mutate flat fields;
  - freeform Basics behavior remains unchanged;
  - switching/reinitializing between builder and freeform characters shows the correct ownership state.
- Update `docs/architecture.md`, `docs/state-schema.md`, and `NEW-FEATURES-ROADMAP.md` to record Phase 3F as display-only builder Basics integration with no schema change and no materialization.

Acceptance criteria:

- `npm run test:run`
- `npm run typecheck`
- `npm run build`
