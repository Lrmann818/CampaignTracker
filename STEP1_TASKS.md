# Step 1 — Multi-Character Support: Implementation Tasks

Read `MULTI_CHARACTER_DESIGN.md` first for full context. This file is the ordered task list for Step 1 only.

Work one task at a time. Run `npm run test:run` after each task. Do not proceed to the next task if tests fail.

---

## Task 1 — State shape and migration

**Files:** `js/state.js`

1. Add a `CharacterEntry` typedef that extends the existing `CharacterState` with an `id: string` field.
2. Add a `CharactersCollection` typedef: `{ activeId: string | null, entries: CharacterEntry[] }`.
3. Change the default state from `character: { ... }` to `characters: { activeId: null, entries: [] }`.
4. Update `sanitizeForSave` to handle `characters` instead of `character`.
5. Add a migration in `migrateState`: if the state has `character` (old shape), wrap it in the new `characters` shape. If the old character is all defaults/empty, migrate to `{ activeId: null, entries: [] }`. If it has data, generate an ID and wrap it as the first entry.
6. Update all typedefs that reference `CharacterState` to use the new collection shape.

**Tests to write:** Migration from legacy singleton → new collection (with data, without data, with empty character). Round-trip: migrate → sanitize → migrate again should be stable.

---

## Task 2 — Vault and persistence layer

**Files:** `js/storage/campaignVault.js`, `js/storage/persistence.js`

1. Update `CampaignDoc` type: `character` → `characters`.
2. Update `extractCampaignDoc` to read `characters`.
3. Update `normalizeCampaignDoc` to handle both old `character` and new `characters` shapes (defensive normalization).
4. Update `projectActiveCampaignState` to project `characters`.
5. Update `persistRuntimeStateToVault` to persist `characters`.
6. Update `replaceRuntimeState` to copy `characters`.

**Tests to write:** Vault normalization with legacy `character` field, vault normalization with new `characters` field.

---

## Task 3 — Backup import/export

**Files:** `js/storage/backup.js`

1. Update `importBackup` to handle both legacy `character` and new `characters` shapes in incoming data.
2. Update export to write `characters`.
3. Update the validation in `importBackup` that checks `state.character` to check `state.characters`.
4. Update any spell-note text ID scoping that references the active campaign to also be aware of multi-character (if applicable at this stage — may be deferred).

**Tests to write:** Import a legacy backup with singleton character. Import a new-format backup with characters collection. Export and re-import round-trip.

---

## Task 4 — Helper function: getActiveCharacter

**Files:** new file `js/domain/characterHelpers.js` (or add to an existing appropriate module)

1. Create `getActiveCharacter(state)` → returns the active `CharacterEntry` or `null`.
2. Create `getCharacterById(state, id)` → returns a specific entry or `null`.
3. Both should be defensive (handle missing `characters`, missing `entries`, bad `activeId`).

**Tests to write:** All edge cases — null state, missing characters, empty entries, activeId pointing to nonexistent entry, happy path.

---

## Task 5 — Character page panel updates

**Files:** all files in `js/pages/character/panels/`, `js/pages/character/characterPage.js`

This is the biggest task. Every panel currently reads `state.character.*`. Change them all to read from `getActiveCharacter(state)`.

1. Import `getActiveCharacter` in `characterPage.js`.
2. At the top of each panel init, resolve the active character. If null, panels render in empty/default state.
3. Replace every `state.character.X` reference with the resolved active character.
4. **Do not change any panel behavior** — only change where they read/write from.

Approach: do one panel at a time. Verify the app still builds between each panel.

Panel order (simplest to most complex):
1. `proficienciesPanel.js` (25 lines, simplest)
2. `personalityPanel.js` (58 lines)
3. `basicsPanel.js` (226 lines)
4. `attackPanel.js` (380 lines)
5. `equipmentPanel.js` (398 lines)
6. `vitalsPanel.js` (479 lines)
7. `spellsPanel.js` (686 lines)
8. `abilitiesPanel.js` (979 lines)

---

## Task 6 — Combat embedded panels

**Files:** `js/pages/combat/combatEmbeddedPanels.js`

1. Update all `state.character` references to use `getActiveCharacter(state)`.
2. If active character is null, embedded panels should render empty gracefully.

---

## Task 7 — Character page sub-toolbar and selection UI

**Files:** `index.html`, `styles.css`, `js/pages/character/characterPage.js`

1. Add sub-toolbar DOM structure to `index.html` inside `#page-character`, before `#charColumns`.
2. Add a character selector (dropdown/scrollable list showing character names).
3. Add an overflow menu button with: New Character, Delete Character, Rename Character.
4. Wire New Character: creates a blank entry with name "New Character", adds to `entries[]`, sets `activeId`, re-renders.
5. Wire Delete Character: removes active entry from `entries[]`, sets `activeId` to another entry or null, re-renders.
6. Wire Rename Character: prompt for new name, update entry, re-renders.
7. Wire selector: changing selection updates `activeId` and re-renders all panels.
8. Style the sub-toolbar to be compact (single row, mobile-friendly).

**Note:** Level Up, Short/Long Rest, Add to Party/NPCs/Locations, Import/Export are all future steps. Add them as disabled/hidden menu items or omit entirely — do not implement their logic.

---

## Task 8 — Empty state UX

**Files:** `js/pages/character/characterPage.js`, `index.html`, `styles.css`

1. When `characters.entries` is empty, show a prompt overlay on the character page: "Create your first character" with Yes / No buttons.
2. Yes → create a blank character entry (same as New Character flow), dismiss prompt.
3. No → dismiss prompt, leave the page in freeform mode with empty fields.
4. The prompt should not reappear once dismissed (store a flag if needed, or just check if entries exist).

---

## Done criteria

- All existing tests pass (`npm run test:run`).
- New migration tests pass.
- Typecheck passes (`npm run typecheck`).
- Build succeeds (`npm run build`).
- App loads with legacy data and migrates cleanly.
- App loads with fresh campaign, shows empty state, can create/select/delete characters.
- Character panels work identically to before when a character is active.
