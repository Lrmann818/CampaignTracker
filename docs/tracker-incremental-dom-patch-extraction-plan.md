# Tracker Incremental DOM Patch Extraction Plan

## Scope

Design-only follow-up for the tracker card panel dedupe work.

In scope:

- `js/pages/tracker/panels/npcCards.js`
- `js/pages/tracker/panels/partyCards.js`
- `js/pages/tracker/panels/locationCards.js`
- `js/pages/tracker/panels/cards/shared/`

Out of scope in the implementation pass:

- `renderNpcCard(...)`
- `renderPartyCard(...)`
- `renderLocationCard(...)`
- the full rerender shell
- any controller factory or state-shape abstraction

## Duplicate Inventory

The tight duplicate block is the incremental DOM patch section near the top of each controller:

- `npcCards.js:91-239`
- `partyCards.js:96-244`
- `locationCards.js:97-245`

The repeated helper candidates are:

1. `find*CardElById(cardId)`
2. `schedule*MasonryRelayout()`
3. collapse-button focus restoration
4. move-button focus restoration
5. `focusElementWithoutScroll(el)`
6. `patch*CardReorder(cardId, adjacentId, dir)`
7. `patch*CardCollapsed(cardId, collapsed, focusEl)`
8. `patch*CardPortrait(cardId, hidden, focusEl)`

All three panels currently use the same DOM structure and selectors for these paths:

- `.trackerCard[data-card-id="..."]`
- `.cardCollapseBtn`
- `.moveBtn`
- `.npcCollapsible`
- `.npcCardFooter`
- `.npcHeaderRow`
- `.npcCardBodyStack`
- `.npcPortraitTop`
- `.cardPortraitToggleBtnHeader`
- `.cardPortraitToggleBtnOverlay`

The only meaningful variation inside the duplicate block is panel-local data and copy:

- `getNpcById` vs `getPartyMemberById` vs `getLocationById`
- portrait alt text
- portrait pick handler
- portrait hidden-toggle handler

## Narrowest Safe Extraction Boundary

Safest boundary: one new shared helper module for controller-local DOM patch behavior only.

Recommended new file:

- `js/pages/tracker/panels/cards/shared/cardIncrementalPatchShared.js`

This shared module should own:

- card lookup by `data-card-id`
- masonry relayout scheduling
- focus helpers
- reorder FLIP patching
- collapsed-state patching
- portrait patching

This shared module should not own:

- panel state reads beyond injected callbacks
- `updateNpc` / `updateParty` / `updateLoc`
- `setNpcPortraitHidden` / `setPartyPortraitHidden` / `setLocPortraitHidden`
- filtering or visible-list computation
- jump-debug setup
- card-body rendering
- rerender shell behavior

## Proposed API Shape

Use a tiny DOM-patcher factory, not a controller factory:

```js
export function createCardIncrementalDomPatcher({
  cardsEl,
  blobIdToObjectUrl,
}) {
  return {
    findCardElById(cardId) {},
    scheduleMasonryRelayout() {},
    focusElementWithoutScroll(el) {},
    focusCollapseButton(cardId, fallbackEl = null) {},
    focusMoveButton(cardId, dir) {},
    patchReorder(cardId, adjacentId, dir) {},
    patchCollapsed(cardId, collapsed, focusEl = null) {},
    patchPortrait({
      cardId,
      hidden,
      focusEl = null,
      getItemById,
      getBlobId,
      getAltText,
      onPick,
      onToggleHidden,
    }) {},
  };
}
```

Notes on shape:

- `cardsEl` stays captured once because every duplicate helper already closes over it.
- `blobIdToObjectUrl` is the only stable portrait dependency worth capturing at construction time.
- `patchPortrait(...)` keeps all state-shape knowledge injected through callbacks.
- Keep current selectors, transition timing, reduced-motion handling, `requestAnimationFrame` timing, and focus fallback order unchanged.

## What Must Stay Panel-Local

Keep these local in each panel file:

- `getVisibleNpcs()` / `getVisibleParty()` / `getVisibleLocations()`
- `updateNpc(...)` / `updateParty(...)` / `updateLoc(...)`
- `setNpcPortraitHidden(...)` / `setPartyPortraitHidden(...)` / `setLocPortraitHidden(...)`
- `moveNpcCard(...)` / `movePartyCard(...)` / `moveLocCard(...)`
- `pickNpcImage(...)` / `pickPartyImage(...)` / `pickLocImage(...)`
- all section, search, and filter wiring
- all collection keys: `"npc"`, `"party"`, `"locations"`
- all jump-debug calls
- all card-body rendering and field event wiring

The shared helper should stay DOM-only. The panels should continue to decide when state changes happen and when fallback full rerenders happen.

## Exact Files For The Implementation Pass

Change:

1. `js/pages/tracker/panels/cards/shared/cardIncrementalPatchShared.js` (new)
2. `js/pages/tracker/panels/npcCards.js`
3. `js/pages/tracker/panels/partyCards.js`
4. `js/pages/tracker/panels/locationCards.js`

Do not change:

- `js/pages/tracker/panels/cards/shared/cardPortraitRenderShared.js`
- `js/pages/tracker/panels/cards/shared/cardsShared.js`
- `renderNpcCard(...)`
- `renderPartyCard(...)`
- `renderLocationCard(...)`

## Safest Implementation Order

1. Add `cardIncrementalPatchShared.js` with behavior copied exactly from the current panel implementations.
2. Move the leaf utilities first inside that file: card lookup, relayout scheduling, `focusElementWithoutScroll`, collapse-button focus, move-button focus.
3. Move `patchReorder(...)` and `patchCollapsed(...)` next with the current selectors and FLIP timing unchanged.
4. Move `patchPortrait(...)` last, keeping portrait data and actions callback-driven from each panel.
5. Update each panel to instantiate the shared DOM patcher and replace only the duplicated helper block.
6. Leave render shells, body renderers, filtering, state updates, and controller wiring untouched.

Landing expectation for the implementation pass:

- one narrow PR
- no production behavior changes
- dedupe limited to the incremental DOM patch path only
