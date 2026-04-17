# Step 3 After Phase 3G: HP vs AC Recommendation

## 1. Executive Summary

- Recommendation: **neither HP-first nor AC-first yet**. The safest next slice is a **Vitals groundwork slice**: builder-derived **speed and hit dice display** in normal and embedded Vitals, with no HP/AC automation.
- Why: HP already touches combat, linked tracker cards, and current/max semantics. AC avoids combat coupling but has no structured armor/shield inputs, so a visible derived AC would be misleading or require schema/override/equipment scope.
- Smallest safe product move: extend the proven Phase 3G builder-owned Vitals pattern to fields whose required inputs already exist: species speed, class hit die, and level.

## 2. Current Derivation Status

- [deriveCharacter.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/rules/deriveCharacter.js) derives mode, class/species/background labels, level, proficiency, ability totals/modifiers, saves, skills, and initiative.
- It does **not** derive HP, AC, speed, hit dice, spell attack/DC, attacks, equipment, armor, shields, or resources.
- Current builtin content in [builtinContent.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/rules/builtinContent.js) has class `hitDie` and species `speed`.
- HP-relevant existing inputs: `build.classId`, `build.level`, class `hitDie`, Constitution modifier from builder abilities.
- AC-relevant existing inputs: Dexterity modifier from builder abilities.
- Missing HP inputs: HP policy, per-level HP choices, current HP behavior, manual HP overrides, multiclass policy, current/max sync, linked combat/card policy.
- Missing AC inputs: armor registry entries, equipped armor/shield state, Dex cap rules, unarmored defense, natural armor, magic/misc overrides, schema-backed correction path.

## 3. HP-First Assessment

- A truly bounded HP-first slice would need to be max-HP display only, probably `level 1 = hit die + Con mod` and later levels fixed average + Con mod.
- Required decisions first: fixed vs rolled HP, minimum per level, what happens when level changes, whether current HP remains manual, whether hit dice derive with max HP, and whether linked combat cards see derived max HP.
- Display-only normal/embedded Vitals is technically possible, but not very safe: `hpCur` and `hpMax` are canonical combat/linking fields today.
- Combat risk: linked combat cards resolve HP through [cardLinking.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/cardLinking.js) and direct combat HP actions write current HP back through tracker cards.
- Tracker risk: linked-card snapshots copy `hpCur` and `hpMax`; if builder max HP is not materialized, snapshots and card displays can diverge.
- HP-first should not use flat `hpMax` as a hidden builder override, because that breaks the current no-materialization/no-flat-builder-storage boundary.
- HP-first does not strictly require schema if it is display-only, but it becomes low-value and confusing unless combat/card behavior is addressed.

## 4. AC-First Assessment

- A truly bounded AC-first slice would likely be unarmored AC only: `10 + Dex modifier`.
- Required decisions first: whether unarmored AC is acceptable as “Armor Class,” whether builder AC becomes read-only, how users represent armor/shields, and whether flat `ac` can be used as a manual correction.
- Display-only normal/embedded Vitals is technically easier than HP because AC is not currently part of tracker linking or combat HP writeback.
- The product risk is worse than the code risk: most builder characters need armor/shield choices, and current content has no armor entries or `build.equippedArmor`.
- AC-first does not need schema for unarmored-only display, but it needs schema or builder choice storage for any correct armor/shield workflow.
- Hidden trap: using flat `character.ac` as a builder override would be override creep through a legacy field.

## 5. Comparison And Recommendation

- HP has better existing rule inputs but worse application coupling: current/max HP, combat healing clamps, linked tracker cards, snapshots, and canonical writebacks.
- AC has less combat coupling but lacks the core data model: armor, shields, Dex caps, and AC override choices.
- Recommendation: **pause HP/AC and implement groundwork first**.
- Groundwork slice: derive and display builder-owned **speed and hit dice** in Vitals using existing species/class/level content.
- This proves the multi-field builder-owned Vitals pattern without combat/card-linking changes, schema changes, equipment modeling, or HP/AC rules.

## 6. Freeform Preservation

- Freeform characters must keep editing `hpCur`, `hpMax`, `hitDieAmt`, `hitDieSize`, `ac`, `speed`, `proficiency`, and other Vitals flat fields exactly as today.
- HP and AC must remain fully manual for both freeform and builder characters during the recommended groundwork slice.
- Existing combat HP flows, linked card HP writebacks, and tracker card snapshots must remain unchanged.
- Hidden breakage to avoid: a generalized builder-owned Vitals helper accidentally locking HP, AC, initiative, spell fields, or freeform fields.

## 7. Malformed Builder Behavior

- For recommended speed/hit-dice groundwork, incomplete builder data should display blank derived fields, stay builder-owned/read-only, and avoid falling back to stale flat fields.
- Missing species: speed blank.
- Missing or unknown class: hit die amount/size blank.
- Bad level: use current `deriveCharacter(...)` normalization if safe; if derivation throws or produces non-finite values, display blank.
- Never mutate, normalize, mark dirty, or materialize state during display fallback.

## 8. Exact Files Likely To Change

Likely required:
- [deriveCharacter.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/rules/deriveCharacter.js)
- [vitalsPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/vitalsPanel.js)
- [rulesEngine.test.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/tests/rulesEngine.test.js)
- [characterPanels.activeCharacter.test.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/tests/characterPanels.activeCharacter.test.js)
- [docs/state-schema.md](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/docs/state-schema.md)
- [docs/architecture.md](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/docs/architecture.md)
- [NEW-FEATURES-ROADMAP.md](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/NEW-FEATURES-ROADMAP.md)

Likely unnecessary:
- [builtinContent.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/rules/builtinContent.js), because speed and hitDie data already exist.
- [cardLinking.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/cardLinking.js)
- [combatEmbeddedPanels.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/combat/combatEmbeddedPanels.js)
- [combatEncounterActions.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/domain/combatEncounterActions.js)
- [builderSummaryPanel.js](/Users/laurenmann/Documents/DnDwebApps/CampaignTracker/js/pages/character/panels/builderSummaryPanel.js)

## 9. Tests Needed

- Rules engine: builder derives speed from species, hit die size from class, hit die amount from level, and does not mutate input.
- Rules engine: missing/unknown species or class returns null/blank-safe derived vitals with warnings, not throws.
- Normal Vitals: builder speed and hit dice display derived values, ignore stale flat fields, are read-only, and attempted input does not dirty or mutate.
- Normal Vitals: freeform speed and hit dice remain editable flat fields.
- Embedded Combat Vitals: same builder-derived speed/hit-dice display through existing `initVitalsPanel` selectors.
- Switching: builder/freeform active-character changes restore value source and ownership.
- Builder Identity edits: species/class/level changes refresh derived Vitals through existing invalidation.
- Regression: HP and AC remain manual and writable exactly as before.

## 10. Risks And Hidden Scope Traps

- Combat coupling: do not touch combat HP, participant creation, healing clamps, or tracker writeback.
- Card linking: do not make linked cards resolve derived HP yet.
- Current vs max HP semantics: do not derive or auto-fill current HP.
- AC dependency explosion: do not add armor, shield, natural armor, unarmored defense, or equipment parsing.
- Dirty marking: display refresh and blocked builder edits must not call `markDirty`.
- Flat-field writes: do not copy derived speed or hit dice into `speed`, `hitDieAmt`, or `hitDieSize`.
- Override creep: do not add HP/AC/speed/hit-dice overrides in this slice.
- Schema creep: no schema version or migration change.
- Materialization creep: do not wire `materializeDerivedCharacterFields(...)`.

## 11. Explicit Non-Goals

- No HP automation.
- No AC automation.
- No armor, shield, equipment, attack, spell, subclass, save, or skill automation.
- No full builder wizard or level-up flow.
- No custom content expansion.
- No schema migration or new override shape.
- No linked-card or combat behavior changes.
- No materialization into flat fields.
- No removal of Builder Identity, Builder Abilities, or Builder Summary scaffolding.

## 12. Draft Implementation Prompt

```text
You are working in Lore Ledger / CampaignTracker on the current local Refactoring branch.

Implement the next Step 3 groundwork slice only: builder-derived speed and hit dice display in normal and embedded Vitals.

Do not implement HP, AC, armor, shields, equipment, attacks, spells, saves, skills, subclass, full wizard work, schema migration, new overrides, linked-card changes, combat changes, or derived-field materialization.

Requirements:
- Extend deriveCharacter(...) with a small derived Vitals shape for speed and hit dice.
- For builder characters:
  - speed comes from selected species content data.speed.
  - hit die size comes from selected class content data.hitDie.
  - hit die amount comes from normalized builder level.
  - missing or malformed required content should produce null display values and warnings, not throws.
- For freeform characters:
  - derived Vitals should mirror existing flat speed, hitDieAmt, and hitDieSize if exposed by the helper.
  - Freeform UI behavior must remain unchanged.
- In vitalsPanel.js:
  - For builder characters only, display derived speed, hitDieAmt, and hitDieSize in the existing Vitals fields.
  - Make those fields read-only/builder-owned for builder characters.
  - Ignore attempted builder input by restoring the derived display without markDirty, notifyPanelDataChanged, or flat-field writes.
  - Preserve HP, AC, initiative, spell attack/DC, resources, and status behavior exactly.
  - Preserve all freeform Vitals editing exactly.
  - Ensure embedded Combat Vitals gets the same behavior through existing selectors.

Tests:
- Add focused rulesEngine tests for builder/freeform speed and hit dice derivation, missing content safety, and no mutation.
- Add focused characterPanels.activeCharacter tests for normal Vitals, embedded Combat Vitals, freeform preservation, malformed/incomplete builder data, active-character switching, Builder Identity refresh, and HP/AC unchanged behavior.

Docs:
- Update docs/state-schema.md, docs/architecture.md, and NEW-FEATURES-ROADMAP.md to record this as no-schema-change builder-derived speed/hit-dice Vitals groundwork.
- Explicitly state HP/AC automation, combat/card linking, overrides, schema migration, and materialization remain future work.

Verify with:
- npm run test:run -- tests/rulesEngine.test.js tests/characterPanels.activeCharacter.test.js
- npm run typecheck
- npm run verify when feasible
```
