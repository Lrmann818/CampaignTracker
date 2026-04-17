**1. Executive Summary**

The safest smallest Phase 3G slice is: make the normal and embedded Vitals proficiency field display builder-derived proficiency read-only for builder characters, and make Abilities/Skills read the same derived proficiency directly for builder characters.

A Vitals-only slice is too fragile because [abilitiesPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/abilitiesPanel.js) currently reads `#charProf` from the DOM on the character page and falls back to flat `character.proficiency` in embedded combat. That would leave render-order and combat inconsistencies.

**2. Recommended Scope**

Recommended exact scope: “display-only builder-derived proficiency in Vitals, plus the minimal Abilities/Skills proficiency-source hardening needed to avoid stale DOM and combat fallback bugs.”

Include:
- Builder `charProf` / `combatEmbeddedCharProf` displays `deriveCharacter(character).proficiencyBonus`.
- Builder proficiency input is read-only and does not write `character.proficiency`.
- Abilities/Skills uses derived builder proficiency for existing save/skill math.
- Freeform proficiency remains editable and stored in flat `character.proficiency`.

Exclude:
- No HP, AC, initiative, spell attack/DC, hit dice, save proficiency, skill proficiency, class-save, or skill-source automation.
- No materialization into flat fields.

**3. Existing Behavior And Coupling**

[Vitals](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/vitalsPanel.js) currently treats `charProf` like every other vital number: it reads `getCurrentCharacter()?.proficiency` and writes `updateCharacterField("proficiency", ...)`.

[Abilities](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/abilitiesPanel.js) has a direct cross-panel dependency:
- It calls `document.getElementById("charProf")`.
- If that normal-page DOM input exists, it uses its current value.
- If absent, it falls back to `getActiveCharacter(state)?.proficiency`.

This is riskier than Basics because Basics owns its own displayed fields. Abilities is a separate consumer whose calculations can become stale if Vitals has not rendered, has not refreshed after Builder Identity level changes, or is absent.

Combat embedded Abilities uses the same Abilities module, but it does not have `#charProf`; embedded Vitals uses `#combatEmbeddedCharProf`. So embedded Abilities currently falls back to flat `character.proficiency`, which is exactly the wrong source for builder characters.

**4. Safe Implementation Strategy**

Yes, builder `charProf` in Vitals should display from `deriveCharacter(character).proficiencyBonus`, through a small local helper with `try/catch` and a finite-number guard.

Yes, Abilities/Skills should read proficiency directly from derivation for builder characters. Smallest safe pattern:
- Add a local `getBuilderProficiencyBonus(character)` helper in Abilities.
- In `getProfBonus()`, if `isBuilderCharacter(getCharacter())`, return the finite derived proficiency or `0`.
- Preserve the current DOM-first/freeform path for non-builder characters.

In Vitals:
- Add builder ownership only for the proficiency field.
- Display numeric `"3"` rather than signed `"+3"` because the field is `type="number"`.
- On builder input attempts, restore the derived value and return without `updateCharacterField`, `markDirty`, or `notifyPanelDataChanged("vitals")`.
- On `"character-fields"` invalidation, refresh the builder-derived proficiency field so Builder Identity level edits update Vitals.

**5. Freeform Preservation**

Freeform characters must keep today’s behavior:
- `charProf` remains editable.
- Input writes only `character.proficiency`.
- Abilities keeps using the existing `#charProf` DOM value on the character page and flat-state fallback when that DOM id is absent.
- Existing save/skill controls and persisted `skills.*.value` behavior remain unchanged.

Hidden freeform risk to avoid: do not route freeform through `deriveCharacter(...)` in Abilities just because the helper exists. Even if equivalent for proficiency today, it changes the dependency boundary and can hide future behavior drift.

**6. Malformed Builder Behavior**

If a character is builder-mode but proficiency derivation throws or does not produce a finite number:
- Vitals should show an empty proficiency field, keep it builder-owned/read-only, and not fall back to `character.proficiency`.
- Abilities should use `0` as the proficiency additive for existing formulas, not stale DOM and not flat `character.proficiency`.
- The UI should not mutate state, normalize the bad data, materialize a fallback, or mark dirty.

If derivation can safely normalize incomplete builder level to level 1, as it currently does, displaying proficiency `2` is acceptable because that is the current rules-engine result.

**7. Exact Files Likely To Change**

Likely required:
- [vitalsPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/vitalsPanel.js)
- [abilitiesPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/abilitiesPanel.js)
- [characterPanels.activeCharacter.test.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/tests/characterPanels.activeCharacter.test.js)
- [architecture.md](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/docs/architecture.md)
- [state-schema.md](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/docs/state-schema.md)
- [NEW-FEATURES-ROADMAP.md](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/NEW-FEATURES-ROADMAP.md)

Likely unnecessary:
- [deriveCharacter.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/rules/deriveCharacter.js), because proficiency derivation already exists.
- [characterHelpers.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/characterHelpers.js), because builder detection already exists.
- [builderSummaryPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/builderSummaryPanel.js), because it already displays derived proficiency.
- [combatEmbeddedPanels.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/combat/combatEmbeddedPanels.js), because runtime embedded Vitals/Abilities use hosted panel modules.
- [rulesEngine.test.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/tests/rulesEngine.test.js), unless derivation behavior changes, which it should not.
- [characterPage.test.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/tests/characterPage.test.js), because it mocks Vitals and Abilities.
- [combatEmbeddedPanels.test.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/tests/combatEmbeddedPanels.test.js), unless choosing to update the currently unused `getVitalsEmbeddedViewModel`.

**8. Tests Needed**

Add focused panel tests in [characterPanels.activeCharacter.test.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/tests/characterPanels.activeCharacter.test.js):
- Builder Vitals displays derived proficiency from level, ignores flat `proficiency: 99`, is read-only, and does not dirty or mutate on attempted input.
- Freeform Vitals proficiency remains editable and writes flat `character.proficiency`.
- Builder Identity level change or `"character-fields"` notification refreshes Vitals proficiency without flat writes.
- Builder Abilities/Skills save and skill totals use derived proficiency even when flat proficiency or `#charProf` is stale.
- Embedded Combat Vitals displays builder-derived proficiency through `initVitalsPanel` selectors.
- Embedded Combat Abilities uses derived proficiency even when no normal-page `#charProf` exists.
- Malformed builder derivation does not fall back to flat proficiency or mutate state.
- Switching between builder and freeform via existing reinit or invalidation restores value and ownership.

Run at minimum:
- `npm run test:run -- tests/characterPanels.activeCharacter.test.js`
- `npm run typecheck`
- Prefer full `npm run verify` before handoff.

**9. Risks And Hidden Scope Traps**

Main risks:
- DOM-order coupling: avoid making Abilities depend on Vitals having rendered first.
- Stale DOM: Builder Identity level changes currently notify `"character-fields"`, while Vitals only refreshes status on that channel.
- Combat side effects: embedded Abilities lacks `#charProf`, so a DOM-only fix fails there.
- Dirty marking: display refresh and blocked builder edits must not call `markDirty`.
- Flat-field writes: never write derived proficiency into `character.proficiency`.
- Save/skill creep: do not switch to `derived.saves` or `derived.skills`; only replace the proficiency scalar used by existing UI formulas.
- Override creep: do not add `overrides.saves` or `overrides.skills` UI.

**10. Explicit Non-Goals**

Do not implement:
- HP automation.
- AC automation.
- Initiative automation beyond existing derivation internals.
- Spell attack/DC automation.
- Hit dice automation.
- Class-derived save proficiency display.
- Species/background/class skill proficiency automation.
- Subclasses, full wizard, level-up flow, custom content.
- Save/skill override expansion.
- Schema migration or schema version changes.
- `materializeDerivedCharacterFields(...)` wiring.
- Removal of Builder Identity, Builder Abilities, or Builder Summary scaffolding.

**11. Draft Implementation Prompt**

```text
You are working in Lore Ledger / CampaignTracker on the Refactoring branch. Implement Step 3 Phase 3G only: display-only builder-derived proficiency in Vitals plus the minimal Abilities/Skills proficiency-source hardening needed for safety.

Do not implement HP, AC, saves, skills, spells, attacks, subclass, wizard, schema migration, or derived-field materialization.

In js/pages/character/panels/vitalsPanel.js:
- For builder characters only, make the proficiency field display deriveCharacter(character).proficiencyBonus.
- Keep the field read-only/builder-owned, with aria-readonly/title or existing local ownership style.
- Do not write builder-derived proficiency into character.proficiency.
- If a builder user/program attempts input, restore the derived display and return without markDirty or notify.
- Preserve all freeform Vitals behavior exactly.
- Refresh builder-derived proficiency on character-fields invalidation so Builder Identity level edits update Vitals.

In js/pages/character/panels/abilitiesPanel.js:
- Change getProfBonus so builder characters read proficiency directly from deriveCharacter(getCharacter()).proficiencyBonus.
- Keep the existing DOM-first #charProf path for freeform characters.
- If builder derivation fails or proficiency is not finite, use 0 as the proficiency additive and do not fall back to flat character.proficiency.
- Do not switch saves/skills to derived.saves or derived.skills. Existing save checkboxes, skill levels, misc bonuses, and builder non-persistence behavior must remain unchanged.

Tests:
- Add focused tests in tests/characterPanels.activeCharacter.test.js for builder Vitals display/read-only/no mutation, freeform preservation, Builder Identity level refresh, malformed builder no flat fallback, normal Abilities calculations with stale/flat proficiency, embedded Combat Vitals, and embedded Combat Abilities without normal #charProf.
- Do not modify rules-engine tests unless derivation behavior changes, which it should not.

Docs:
- Update docs/architecture.md, docs/state-schema.md, and NEW-FEATURES-ROADMAP.md to record Phase 3G as no-schema-change display-only builder-derived proficiency in Vitals, with Abilities using the same derived proficiency scalar for existing manual save/skill formulas. Explicitly state that save/skill automation and materialization remain future work.

Verify with npm run test:run -- tests/characterPanels.activeCharacter.test.js, npm run typecheck, and preferably npm run verify.
```
