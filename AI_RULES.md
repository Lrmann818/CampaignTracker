# AI_RULES.md — Campaign Tracker (Codex / VS Code)

This project is a modular, UI-heavy, client-side web app.
Stability, consistency, and backward compatibility are non-negotiable.

Codex MUST follow these rules.

---

## 0) Prime directive
DO NOT break existing behavior.

This includes:
- Panel collapse / expand behavior
- Panel reordering controls
- SaveManager dirty-state & persistence
- Dropdown consistency
- Mobile layout (no clipping, no horizontal scroll)
- Existing saved data loading correctly

Minimal, targeted changes are always preferred over refactors.

---

## 1) Application structure (source of truth)

### Pages (tab-based)
Pages are toggled via:
- `.tab[data-tab]`
- `.page` sections:
  - `#page-tracker`
  - `#page-character`
  - `#page-map`

Rule:
- Never change page switching logic without confirming all tabs still work.

---

## 2) Global UI contracts (DO NOT BREAK)

### Top bar
- Campaign title: `#campaignTitle` (contenteditable)
- Status messages: `#statusText`
- Clock: `#topbarClock`

Rules:
- Errors, save status, and feedback must continue to appear in `#statusText`.
- Do not replace this messaging system.

---

### Calculator & Dice
Dropdown systems:
- Calculator
  - Button: `#calcBtn`
  - Menu: `#calcMenu`
- Dice Roller
  - Button: `#diceBtn`
  - Menu: `#diceMenu`

Rules:
- These are dropdown menus, not modals.
- Do not replace dropdown logic with a new system.
- Respect `aria-expanded` and `[hidden]` toggling.

---

### Data & Settings modal
Modal system:
- Overlay: `#dataPanelOverlay`
- Panel: `#dataPanelPanel`

Rules:
- Use the existing modal/overlay behavior.
- Do not add new modal frameworks.
- Do not break focus or keyboard behavior.

---

## 3) Panels (critical behavior)

### Panel identity
Panels use:
`<section class="panel" id="...Panel">`

Examples:
- `#sessionPanel`
- `#npcPanel`
- `#locationsPanel`
- `#charVitalsPanel`
- `#charSpellsPanel`

---

### Panel collapse
Collapse buttons:
`<button class="panelCollapseBtn" data-collapse-target="...">`

Rules:
- Collapsing removes vertical space.
- Panels below must scoot up naturally.
- Do not hide panels via `display:none` unless existing logic does.
- Preserve `aria-expanded`.

---

### Panel reordering
Rules:
- Reorder controls MUST remain available.
- Never remove reorder buttons when touching panel markup.
- Reordering must work on:
  - Tracker page
  - Character page

---

## 4) Tracker page rules (`#page-tracker`)

### Columns
- `#trackerColumns`
- `#trackerCol0`
- `#trackerCol1`

Rule:
- Panels must stay inside columns.
- Do not flatten or restructure layout.

---

### Cards
Containers:
- NPCs: `#npcCards`
- Party: `#partyCards`
- Locations: `#locCards`

Rules:
- Cards are rendered dynamically.
- Event listeners must not multiply on re-render.
- Attach listeners during element creation.

---

### Location filtering & dropdowns
- Filter select: `#locFilter`

Rules:
- Location card dropdowns must visually match other dropdowns.
- If only ONE dropdown needs styling:
  - add a modifier class or data attribute
  - scope CSS to `.locationCard`
- Never globally style `select`.

---

## 5) Character page rules (`#page-character`)

### Columns
- `#charColumns`
- `#charCol0`
- `#charCol1`

Rules:
- Panels must remain column-based.
- Panels must remain reorderable.

---

### Character basics
Key inputs:
- `#charName`
- `#charClassLevel`
- `#charRace`
- `#charBackground`
- etc.

Textareas with UI persistence:
`<textarea data-persist-size>`

Rule:
- Do not remove or bypass `data-persist-size`.

---

### Abilities & skills
Ability blocks:
`.abilityBlock[data-ability="str|dex|con|int|wis|cha"]`

Rules:
- Calculations must remain deterministic.
- Checkbox state must not desync values.
- Do not duplicate ability logic.

---

### Spells
- Container: `#spellLevels`
- Levels and spells are dynamically rendered.

Rules:
- Helper functions (e.g. `newSpell()`) MUST exist before use.
- Adding spells MUST:
  - update state
  - call `SaveManager.markDirty()`
  - re-render safely

---

## 6) Map page rules (`#page-map`)

### Canvas
- Canvas: `#mapCanvas`
- Wrapper: `.canvasWrap`

Rules:
- Do not recreate canvas unless required.
- Preserve undo/redo stacks.
- Image upload/remove must continue to work.

---

## 7) JavaScript rules (non-negotiable)

### State & persistence
- User-visible changes require `SaveManager.markDirty()`.
- New data fields must be backward compatible:

`obj.newField ?? defaultValue`

Never break existing saved data.

---

### Rendering & events
- Re-render means rebuild DOM + reattach listeners.
- Never attach listeners inside loops without guards.
- One click must equal one action.

---

### Errors
- Use the existing global error/status system.
- Fail soft.
- Do not silently swallow errors.

---

## 8) CSS rules (prevent self-overwriting)

### Scope first
Prefer:
- `.panel ...`
- `.locationCard ...`
- `.npcCard ...`

---

### Targeting a single element
Add:
- `.isVariant`
or
- `data-variant="x"`

Then style:
`.locationCard .cardSelectDropdownBlock.isTypeDropdown { ... }`

---

### Avoid
- Global `select {}` rules
- Deep specificity chains
- CSS fixes dumped at the bottom without context

---

## 9) Accessibility minimums
- Buttons must have `type="button"` unless submitting a form.
- Inputs must remain focusable.
- Do not remove focus outlines without replacement.
- `aria-expanded` must reflect actual state.

---

## 10) Hard bans
- No frameworks
- No build tools
- No storage format changes without migration
- No feature removal
- No large CSS rewrites “for cleanliness”

---

## 11) Required verification checklist
After any change:
- Existing saved data loads
- Add/edit/delete still works
- Refresh persists changes
- Mobile has no clipped headers
- No horizontal scrolling
- Console has no errors
- No duplicate event handlers

---

## 12) If uncertain
When in doubt:
1. Find the closest existing pattern
2. Match it exactly
3. Make the smallest possible change
4. Add defensive checks
5. Document assumptions

End of rules.
