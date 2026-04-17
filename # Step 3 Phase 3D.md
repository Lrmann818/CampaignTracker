# Step 3 Phase 3D
 Builder‑Owned Sheet Strategy

## Executive summary

Lore Ledger’s Step 3 builder foundation introduced a rules engine and a builder metadata object (`build`) that allows characters to derive class, race/species, background, level, proficiency bonus, ability scores, saves, skills and initiative without modifying existing flat fields.  The current UI uses temporary builder panels (Identity, Abilities and Summary) which display or edit this metadata while leaving the normal character sheet and combat panels fully freeform.  Phase 3D aims to make the normal character sheet the primary surface for builder characters without duplicating fields or confusing users.  The key idea is to treat `deriveCharacter()` as the canonical source for any values that can be derived from builder metadata, to avoid materializing derived values back into persisted flat fields, and to provide an override mechanism when users edit builder‑derived values.  The recommended incremental slice is to display builder‑derived ability scores and proficiency bonus in the existing Abilities/Skills panel and basics panel, while keeping freeform editing possible through overrides and leaving the temporary builder panels visible as scaffolding.

## Current implementation facts

### Flat fields and normal panels

* **Basics panel (`basicsPanel.js`)** writes and reads canonical flat fields: `name`, `classLevel`, `race`, `background`, `alignment`, `experience`, `features`, and `imgBlobId`.  It binds inputs directly to these fields via `updateCharacterField`【704154890246585†L189-L248】.
* **Vitals panel (`vitalsPanel.js`)** manages `hpCur`, `hpMax`, `hitDieAmt`, `hitDieSize`, `ac`, `initiative`, `speed`, `proficiency`, `spellAttack`, `spellDC` and a list of resource tiles.  Each number field is bound to a flat field path via `vitalNumberFields` and uses `updateCharacterField` to persist changes【642279483669309†L190-L216】.
* **Abilities panel (`abilitiesPanel.js`)** owns `character.abilities` (six ability objects with `score` and `saveProf`) and `skills` (records with proficiency level, misc, value) and `saveOptions`.  It ensures ability shape defaults and updates the flat `abilities.*.score` fields and skill levels.  Modifier and save totals are computed at runtime; they are not persisted【600414392870090†L353-L368】.
* **Proficiencies panel (`proficienciesPanel.js`)** edits `armorProf`, `weaponProf`, `toolProf` and `languages` via textareas【962452020319753†L14-L33】.
* **Personality panel (`personalityPanel.js`)** edits `personality.traits`, `ideals`, `bonds`, `flaws` and `notes`【664969849912761†L18-L67】.
* **Equipment panel (`equipmentPanel.js`)** edits `inventoryItems`, `activeInventoryIndex`, `inventorySearch` and `money` (pp, gp, ep, sp, cp)【252272778892449†L146-L188】.
* **Attacks panel (`attackPanel.js`)** edits `attacks` array with weapon properties (id, name, bonus, damage, range, type)【859631743334520†L17-L90】.
* **Spells panel (`spellsPanel.js`)** manages `spells.levels` and uses separate IndexedDB notes; not yet integrated with builder.
* **Entire state shape** is described in `state-schema.md`.  The character entry contains flat fields for basics and vitals, `abilities`, `skills`, `resources`, `spells`, `attacks`, `inventoryItems`, `money`, `personality` and a `ui` subobject.  Builder metadata lives under `build`, and per‑field overrides live under `overrides`【795126684248012†L516-L597】.

### Builder metadata, overrides and derivation

* **Builder metadata** (`build`) has optional fields: `speciesId`, `classId`, `backgroundId`, `subclassId`, `level`, `abilityMethod`, `abilities.base` and `choicesByLevel`.  `build: null` indicates freeform characters【795126684248012†L569-L597】.
* **Overrides** persist user changes to derived totals: `abilities` (a number per ability), `saves`, `skills` (by skill id) and `initiative`【795126684248012†L569-L597】.
* **deriveCharacter.js** is the pure rules engine.  Given a character and builtin content, it returns derived values: labels (class/level, species, background), `level` and `proficiencyBonus` from builder or from flat `proficiency`, `abilities` total and modifier (base + override), `saves` total, `skills` total, `initiative` and more【811776982911957†L188-L319】.  For builder characters, it uses `build.level`, `build.abilities.base` and the content registry (species/class/background).  For freeform characters it uses flat fields.  `materializeDerivedCharacterFields()` can copy derived values into a clone but is not used in the UI【854109438155760†L329-L354】.

### Temporary builder panels

* **Builder Identity panel** edits only `build.speciesId`, `build.classId`, `build.backgroundId` and `build.level`.  It shows select inputs for species/class/background (with content IDs) and a numeric level field.  It does not touch flat fields like `classLevel`, `race` or `background`【311812524607920†L196-L204】【311812524607920†L274-L285】.
* **Builder Abilities panel** allows entering base ability scores into `build.abilities.base.<key>`.  It does not modify `abilities.<key>.score`【4552773149586†L146-L163】【4552773149586†L224-L233】.
* **Builder Summary panel** is display‑only.  It calls `deriveCharacter()` to compute labels, proficiency bonus, ability totals and modifiers.  It does not persist any values and does not lock the flat fields【272769615160893†L95-L128】.
* Tests confirm that editing builder metadata updates the summary but not the flat fields; builder fields remain separate and the existing sheet remains fully editable for freeform and builder characters【656719112535083†L1794-L1816】【656719112535083†L2150-L2179】.  Builder mode detection is strict: `build` must have recognized fields; arbitrary `build` objects do not activate builder mode【439298184244284†L166-L188】.

### Values not yet derivable

Currently `deriveCharacter()` derives level, proficiency bonus, ability totals and modifiers, saves, skills and initiative.  It does **not** derive hit points (HP), AC, spell attack/DC, or equipment; these remain manual fields.  It also does not apply class or species features (HP per level, skills, spells known, proficiencies, etc.), which are future automation tasks listed in the roadmap【365170704002460†L522-L551】.

### What builder panels currently prove/edit

* **Builder Identity** proves that the content registry and `deriveCharacter()` can map content IDs to human‑readable labels.  It edits species, class, background and level, which feed into `deriveCharacter()` and the summary.
* **Builder Abilities** proves that base ability scores can be stored separately and combined with overrides to compute totals, without touching flat ability fields.
* **Builder Summary** demonstrates that derived builder values can be displayed, including proficiency bonus and ability totals, without persisting them back to the sheet.  It also validates that builder mode detection works and that freeform fields remain independent.

## Recommended source‑of‑truth model

1. **Live derivation for builder characters**:  For any field that `deriveCharacter()` can compute (class/level label, species label, background label, level, proficiency bonus, ability totals, modifiers, saves, skills and initiative), the UI should read directly from `deriveCharacter()` when the character is in builder mode.  This avoids duplicating information and keeps builder metadata canonical.  Flat fields should remain editable freeform fields for non‑builder characters and should not be overwritten during derivation.
2. **Deferred materialization**:  Avoid writing derived values back into flat fields except for backward‑compatibility exports.  `materializeDerivedCharacterFields()` exists as an explicit helper for export/print but is not used at runtime.  Persisting duplicates would risk stale data and complicated migration.  Derived values should be computed on the fly each time builder metadata or overrides change.
3. **Override mechanism**:  When a user edits a builder‑derived value directly on the sheet, the edit should be stored in `overrides` rather than the flat field.  This keeps a clear separation: builder metadata is canonical; overrides record deviations; freeform fields are unused for builder characters.  `deriveCharacter()` already applies overrides, so builder characters can have custom values without changing base builder data.
4. **Freeform compatibility**:  Non‑builder characters (`build: null`) continue to use flat fields as the source of truth.  Derived values should not be used for freeform characters except for runtime calculations (e.g., compute ability modifiers from ability scores).  The UI must maintain existing editing flows for freeform characters.
5. **Transition strategy**:  Temporary builder panels (Identity and Abilities) remain until the creation wizard and field‑locking flows exist.  The Summary panel may become collapsible or developer‑only, but should remain visible during Phase 3D to give users confidence that builder choices are applied.

## Field ownership map

The following table maps visible sheet fields to their current storage, builder source, derived source, recommended Phase 3D behavior and future long‑term behavior.  It also notes whether a user override is needed.

| Visible sheet field | Current flat field path | Builder source path | Derived source (via `deriveCharacter()`) | Recommended Phase 3D behavior | Future behavior when full wizard exists | User override? |
|---|---|---|---|---|---|---|
| **Name** | `name` | none (freeform) | none | Unchanged: read/write `name` regardless of builder mode | Same; name always freeform | N/A |
| **Species/Race** | `race` | `build.speciesId` (ID) | Derived species label | For builder: display derived species label but keep `race` input freeform; user can still edit `race` if they want to override label. For freeform: display/edit `race` as today. | In full wizard: `race` field removed or hidden; derived label displayed; override through builder choices or override control. | Yes – editing the race field in builder mode should write an override that replaces the derived label, not change `build.speciesId`. |
| **Class/Level (string)** | `classLevel` | `build.classId` and `build.level` | Derived class label with level (e.g., “Fighter 1”) | For builder: display derived class/level string; hide or disable classLevel input. Freeform characters continue to use `classLevel`. | In wizard: replaced by builder choice and wizard step; `classLevel` freeform field retired. | Yes – editing the class/level text should create an override or transition to freeform mode; however, direct overrides may be deferred until we implement a level‑up flow. |
| **Background** | `background` | `build.backgroundId` | Derived background label | For builder: display derived background; keep `background` input freeform but display derived label separately (e.g., grayed). Freeform remains unchanged. | In wizard: `background` field removed or controlled by builder choice. | Yes – editing should write an override on `background` display or convert to freeform mode. |
| **Level** | Not explicit; stored in `classLevel` string | `build.level` | Derived numeric level | For builder: derive level and proficiency bonus; display as part of class/level. Freeform: level remains part of `classLevel` string. | In wizard: level selected via wizard; override through level‑up flow. | Not initially; overrides may be needed for unusual levels. |
| **Proficiency Bonus** | `proficiency` | none (derived) | Derived from builder level or from flat proficiency field | For builder: compute `proficiencyBonus` via `deriveCharacter()` and display in the Vitals panel; hide freeform proficiency input. Freeform: continue to use `proficiency` input. | In wizard: derived; override possible through override controls. | Yes – editing proficiency in builder mode should write to `overrides.initiative`?  Actually proficiency bonus is not overrideable yet; might not support overrides early. |
| **Ability scores & modifiers** | `abilities.<key>.score` | `build.abilities.base.<key>` | Derived total: base + overrides | For builder: display derived totals in Abilities panel; editing base ability uses builder panel; editing total uses overrides. Freeform: continue to use `abilities.<key>.score`. | In wizard: ability scores chosen via builder method; freeform editing replaced by builder ability step; overrides remain via overrides control. | Yes – editing total should update `overrides.abilities.<key>`. |
| **Skills** | `skills.<skill>.value` + `skills.<skill>.level` + `skills.<skill>.misc` | none yet (class/level to determine proficiency) | Derived from ability modifier and proficiency bonus | For builder: compute skill totals and display; editing proficiency level remains manual for now; editing misc remains manual; computed total becomes read‑only or overrideable. Freeform: unchanged. | In wizard: skill proficiency set via class/background choices; editing level allowed through overrides. | Yes – editing derived total should write to `overrides.skills`. |
| **Saves** | Part of abilities panel (`abilities.<key>.saveProf` + `saveOptions.misc`) | none yet (class save profs) | Derived from proficiency and ability modifier | For builder: compute save totals and display; editing save proficiency remains manual for now; editing misc remains manual; computed total read‑only/overrideable. Freeform: unchanged. | In wizard: class save proficiencies derived; editing allowed via override. | Yes – editing save total writes to `overrides.saves` (future slice). |
| **Initiative** | `initiative` | none | Derived from Dexterity modifier and overrides | For builder: display derived initiative; hide initiative input; editing writes to `overrides.initiative`. Freeform: unchanged. | In wizard: same; editing via override controls. | Yes – editing initiative should update `overrides.initiative`. |
| **HP, AC, Speed** | `hpMax`, `ac`, `speed` | none yet | Not derived yet | Remain freeform fields.  For builder, eventually derive based on class/level and species, but Phase 3D does not modify them. | In wizard: HP/AC derived; editing allowed through overrides; freeform fields retired. | Not yet; overrides when automation added. |
| **Spell attack/DC** | `spellAttack`, `spellDC` | none | Not derived yet | Remain freeform.  Derivation and override left for future phases. | Derived from ability modifier and proficiency; override allowed via overrides. | Not yet. |
| **Spells** | `spells.levels` | none yet | Not derived yet | Remain manual.  Builder spells automation is future work. | Wizard will select spells; editing allowed via notes. | Not yet. |
| **Attacks/Weapons** | `attacks` array | none | Not derived | Remain manual.  Automation is future work (class features). | Derived suggestions may be offered; editing continues via attacks panel. | Not relevant. |
| **Equipment and Money** | `inventoryItems`, `money` | none | Not derived | Remain manual.  No builder integration planned yet. | Possibly derived starting equipment; editing remains. | Not relevant. |
| **Proficiencies (armor, weapon, tool, languages)** | `armorProf`, `weaponProf`, `toolProf`, `languages` | none yet | Not derived | Remain manual.  Builder integration may derive proficiencies from class and species; editing may remain via overrides. | Derived; editing via override. | Eventually. |
| **Personality/Notes** | `personality` fields | none | Not derived | Remain manual always; builder does not define these. | Unchanged. | N/A |

## Temporary builder panel retirement path

| Temporary panel | What it currently does | Replacement UI or flow | Conditions before removal | Required tests before removal | Visibility in Phase 3D |
|---|---|---|---|---|---|
| **Builder Identity** | Provides select inputs for species, class and background and a numeric level.  Writes to `build.speciesId`, `build.classId`, `build.backgroundId` and `build.level`【311812524607920†L196-L204】【311812524607920†L274-L285】. | The full builder creation wizard will collect these choices across steps.  After wizard completion, these values should drive the main sheet, and editing will happen via dedicated dialogs or level‑up flow. | The wizard must exist and populate these fields; the normal sheet must display derived labels from builder; override controls must exist for manual changes; there must be tests verifying that editing the builder identity via wizard or override updates derived values and persists correctly without duplicating flat fields. | End‑to‑end tests for builder identity editing via wizard; tests verifying that switching characters updates the sheet; tests ensuring freeform fields remain unaffected. | Remains visible in Phase 3D as scaffolding.  It may be visually collapsed or marked as deprecated but should not disappear until the wizard exists. |
| **Builder Abilities** | Lets users enter base ability scores into `build.abilities.base`【4552773149586†L146-L163】. | The builder wizard will include an ability score selection step (point buy, standard array, rolling, or manual).  After wizard completion, ability scores will appear directly on the Abilities panel and can be edited via override controls. | The wizard’s ability step must exist and update builder metadata; the normal Abilities panel must read derived totals; an override UI must exist; tests must verify editing and overrides. | Tests for ability selection via wizard; tests verifying derived values update; tests ensuring overrides apply correctly and freeform characters unaffected. | Remains visible in Phase 3D; might be collapsed after Abilities panel starts reading derived scores. |
| **Builder Summary** | Display‑only view of derived class/species/background, level, proficiency bonus and ability totals/modifiers【272769615160893†L95-L128】. | After the sheet is powered by builder data, this panel becomes redundant.  A condensed summary could appear in the Basics or Abilities panel tooltips or as a developer debug panel. | Derived values must be displayed directly on the normal sheet; a debug flag or dev mode can show extra information; tests must confirm display correctness. | Tests verifying normal sheet displays derived values; dev debug panel is hidden by default but accessible for testers. | In Phase 3D, keep summary visible to give users confidence; optionally make it collapsible or hidden behind a toggle.  Post‑wizard, it can be hidden in default UI. |

## UI direction

* **Builder mode indicator**:  Continue to show the Builder Mode badge on the Basics panel header to remind users that the character is in builder mode.  This indicator should remain once duplicate builder panels are removed.
* **Single sheet surface**:  For builder characters, the normal character sheet should display builder‑derived values directly within existing panels, rather than duplicating them in separate panels.  Derived values can be styled (e.g., italic or colored) to indicate they come from builder metadata.
* **Editable vs derived**:  Builder‑derived fields should either be read‑only or accompanied by an override control (e.g., a small pencil/edit icon).  When the user invokes an override, a dialog can allow editing and writes the value to `overrides`, leaving builder metadata untouched.  Freeform fields remain fully editable as today.
* **Temporary builder panels**:  During Phase 3D, the Identity and Abilities builder panels remain visible but could be moved to a secondary tab or collapsed to reduce clutter.  The Summary panel can be collapsible or placed in an expandable section.  A dev/debug flag might hide them entirely for end‑users when the new behavior is ready.
* **Distinguishing builder vs freeform values**:  At this stage, subtle styling or tooltips can explain that certain fields are derived from builder choices.  For example, the proficiency bonus could have a tooltip: “Derived from Fighter 1 (level 1); click to override.”

## Recommended Phase 3D minimal implementation slice

The smallest safe next step to move toward builder‑owned sheet behavior is **integrating builder‑derived ability scores and proficiency bonus into the existing Abilities/Skills panel and Basics panel, while leaving editing via builder panels**.  This slice focuses on reading builder data rather than rewriting the entire sheet:

1. **Display builder‑derived ability totals**:  In the Abilities panel, when `isBuilderCharacter(character)` is true, replace the displayed ability score inputs with derived totals from `deriveCharacter().abilities[key].total`.  Show the modifier computed by the derivation.  Keep the flat `abilities.<key>.score` inputs hidden or grayed out.  Provide a small override button next to each ability; when clicked, prompt the user to enter an override value, storing it in `overrides.abilities[key]`.  Updates to `build.abilities.base` via the Builder Abilities panel should immediately reflect in the Abilities panel.
2. **Display derived proficiency bonus**:  In the Vitals panel (proficiency bonus field) or in the Abilities panel header, display the derived `proficiencyBonus` for builder characters.  Hide the freeform proficiency number field or mark it read‑only.  Provide an override control that stores custom proficiency bonus in `overrides` if necessary.  Initially this override can be deferred to future phases.
3. **Maintain existing editing flows for freeform characters**:  When `build` is null, the panels should behave exactly as today.  Do not derive anything, and continue to read/write flat fields.
4. **Do not remove temporary panels**:  The Builder Identity, Builder Abilities and Builder Summary panels remain visible, giving users access to builder metadata editing and a clear summary.  Document that the Abilities panel now reflects builder data.

This slice is feasible because `deriveCharacter()` already computes ability totals and proficiency bonus, and tests ensure builder metadata does not update flat fields.  It does not require new migrations or schema changes.  It surfaces builder data directly on the sheet, which is a clear step toward the long‑term goal.

## Override strategy

* **Where to write overrides**:  All user edits that alter derived values should write to `overrides`.  For abilities, save totals in `overrides.abilities.<key>`.  For saves, store in `overrides.saves.<key>`.  For skills, store in `overrides.skills[skillId]`.  For initiative, store in `overrides.initiative`.  Flat fields should not be updated for builder characters.
* **How to trigger overrides**:  In Phase 3D, limit override support to ability scores and initiative.  Use an edit button next to the derived value; clicking opens a numeric input dialog.  On confirm, update `overrides.abilities[key]` via `updateCharacterField(state, ["overrides", "abilities", key], newValue)`.  If the user clears the override, remove that property (set to 0 or delete) so `deriveCharacter()` falls back to base.
* **Conflict resolution**:  If the user manually edits the freeform field (e.g., `proficiency` or `classLevel`) while in builder mode, treat this as a request to override.  The UI should warn that manual edits will override derived values and store the entry in overrides rather than replacing builder metadata.  Alternatively, editing these freeform fields could be disabled in builder mode to avoid confusion until override flows exist.
* **Unsupported overrides**:  HP, AC, speed, spell attack/DC, spells, attacks, proficiencies and equipment remain manual fields.  Do not apply builder derivation or overrides to them in Phase 3D.
* **Clearing overrides**:  Provide a small “reset” control to remove an override, causing the field to revert to the derived value.

## Testing plan

1. **Freeform compatibility tests**:  Ensure that for characters with `build: null`, all panels continue to read/write flat fields exactly as before.  Verify that editing ability scores, proficiency, skills, saves and initiative behaves identically to today.
2. **Builder sheet display tests**:  For builder characters, verify that the Abilities panel displays `deriveCharacter().abilities[key].total` and corresponding modifiers.  Confirm that updates to `build.abilities.base` via Builder Abilities refresh the Abilities panel.  Verify that the proficiency bonus displayed matches `deriveCharacter().proficiencyBonus`.  Check that tooltips or styling indicate derived values.
3. **Override tests**:  Create builder characters and enter overrides for ability scores or initiative.  Confirm that the override value is stored in `overrides` and that `deriveCharacter()` adds it to the base and displays the new total.  Check that clearing the override reverts to the derived value.  Ensure that overrides do not update flat fields.
4. **Active character switching tests**:  Ensure that switching from a builder character to a freeform character updates the UI correctly; derived fields revert to manual fields and vice versa.  Confirm that overrides remain associated with the correct character and do not leak across characters.
5. **Combat embedded panel tests**:  The combat embedded Abilities and Vitals panels must display derived values for builder characters and manual values for freeform.  Tests should verify that editing HP or other combat‑relevant values in combat does not corrupt builder metadata.
6. **Linked card safety tests**:  When characters are linked to party/NPC cards or saved and exported, ensure that derived values are not inadvertently materialized; exports should use `materializeDerivedCharacterFields()` only on request.
7. **Temporary panel tests**:  Ensure that Builder Identity, Abilities and Summary panels remain visible during Phase 3D, update correctly when builder metadata changes, hide when switching to freeform characters and do not lock freeform fields.

## Documentation plan

* **Update `docs/state-schema.md`** to clarify that for builder characters, the normal sheet reads from `deriveCharacter()` rather than flat fields for certain values.  Emphasize that derived values are not persisted and that overrides live in `overrides`.  Mark the builder panels as temporary scaffolding.
* **Update `docs/architecture.md`** with a new section describing Phase 3D.  Describe the builder‑owned sheet strategy, the use of derived values on the normal sheet, and the override mechanism.  Note that builder panels remain for now but will be retired once the wizard and override flows replace them.
* **Update `NEW-FEATURES-ROADMAP.md`** to record Phase 3D progress: “Initial builder‑owned sheet integration: Abilities panel displays derived ability scores and proficiency bonus; override controls for abilities; builder panels remain.”  Adjust future items accordingly.
* **Add developer documentation** explaining how to use `deriveCharacter()`, `overrides`, and builder metadata, and how to extend derivation for HP/AC/spells in future phases.

## Risks and trade‑offs

* **Duplicate sources of truth**:  If derived values were materialized into flat fields, stale data or conflicting edits could occur.  By keeping derivation pure and using overrides, we avoid duplication but require runtime computation and UI complexity.
* **User confusion**:  Switching between builder and freeform characters may confuse users if fields suddenly become read‑only or display different values.  Clear visual cues and tooltips are necessary.  Temporary builder panels help by showing the builder metadata explicitly.
* **Panel behavior changes**:  Modifying the Abilities panel to read derived values risks breaking existing logic or tests.  Thorough tests must ensure that freeform behavior remains unchanged and that derived calculations do not inadvertently override manual fields.
* **Combat interactions**:  Combat panels rely on canonical character data.  Introducing derived values must not break combat features (e.g., initiative sorting).  Tests should cover builder characters in combat.
* **Premature materialization**:  Storing derived values prematurely could complicate migration and override logic.  This plan avoids materialization but delays features like HP automation.
* **Incomplete override support**:  Rolling out override controls for abilities and proficiency but not for other fields might frustrate users.  Communicate clearly which fields are currently overrideable and that more automation is planned.
* **Long‑term migration**:  When builder panels are removed and wizard introduced, we must ensure existing builder characters upgrade smoothly.  The plan to keep derived values pure and overrides separate simplifies migration.

## Explicit non‑goals

* **Do not implement the full builder wizard in Phase 3D.**  The wizard, content pickers and level‑up flow are future phases.
* **Do not derive HP, AC, speed, spell attack/DC, spells, attacks, proficiencies or equipment in Phase 3D.**  These remain manual fields until automation is built.
* **Do not remove or hide temporary builder panels yet.**  They remain as scaffolding for editing builder metadata and for user confidence.
* **Do not write derived values into flat fields or persist them during save/migration.**  Materialization is reserved for export routines or future phases.

## Implementation‑ready checklist for Phase 3D

1. **Update Abilities panel:**
   - When rendering ability score inputs, check `isBuilderCharacter(character)`.  If true, fetch derived ability totals and modifiers from `deriveCharacter(character).abilities`.  Display total and modifier instead of the flat `character.abilities[key].score`.  Show an override button next to each ability.  When clicked, prompt the user to enter an override value, storing it in `overrides.abilities[key]`.  If the user clears the override, remove that property (or set to 0) so `deriveCharacter()` falls back to base.
   - Keep `build.abilities.base` editing in the Builder Abilities panel.  On `build.abilities.base` change, re‑call `deriveCharacter()` and refresh the Abilities panel.
   - For freeform characters (`build: null`), keep existing ability score inputs and editing behavior.

2. **Display derived proficiency bonus:**
   - In the Vitals panel or at the top of the Abilities panel, detect builder characters and compute `deriveCharacter().proficiencyBonus`.  Display this number as read‑only.  For builder mode, hide or disable the flat `proficiency` input.  For freeform characters, continue to use `proficiency` input.
   - Optionally add an override button to edit proficiency bonus, storing in `overrides` if supported later.

3. **Refactor panel refresh:**  When builder metadata or overrides change, ensure panels listening to `characters.activeId` and the character entry re‑compute derived data and update the UI.  Use existing invalidation mechanisms to trigger re‑render.

4. **UI cues and tooltips:**  Style derived values (e.g., italic or colored).  Add tooltips explaining that the value comes from builder metadata and that it can be overridden.  The override button can be a pencil icon with a tooltip “Override derived value.”

5. **Maintain temporary panels:**  Do not remove or hide the Builder Identity, Builder Abilities, or Builder Summary panels.  Optionally add a small note to them: “These panels are temporary scaffolding; builder values are now shown directly on the sheet.”

6. **Add tests:**  Implement new Vitest tests in `tests/characterPage.test.js` or new files:
   - Test that a builder character’s Abilities panel shows derived totals and updates when builder base scores change or when overrides are applied.
   - Test that a freeform character’s Abilities panel remains editable and unaffected by builder logic.
   - Test proficiency bonus display for builder vs freeform.
   - Test that overrides persist across page reload and switching characters.
   - Test that builder fields remain unmaterialized in exports unless `materializeDerivedCharacterFields()` is explicitly called.

7. **Update documentation:**  Modify `state-schema.md`, `architecture.md` and `NEW-FEATURES-ROADMAP.md` to reflect Phase 3D changes.  Document the new behavior and the override mechanism.

8. **Code hygiene and TS checks:**  Add `@ts-check` to any new module; update type definitions for `overrides` if new override fields are added; ensure state mutations happen via `updateCharacterField`/`mutateCharacter` to maintain save tracking.

9. **Design review:**  Before merging, review the UI changes with designers and stakeholders to ensure derived values are clearly communicated and that the override UX is acceptable.

10. **Plan next phases:**  Prepare for subsequent phases (3E and beyond) that will extend derivation to HP, AC, spells, skills, subclass choices and incorporate the full wizard.  Use insights from Phase 3D tests to inform those steps.
