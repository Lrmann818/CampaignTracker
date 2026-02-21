// @ts-nocheck
// js/pages/character/characterSectionReorder.js

import { setupPagePanelReorder } from "../../ui/pagePanelReorder.js";

export function setupCharacterSectionReorder({ state, SaveManager }) {
  return setupPagePanelReorder({
    state,
    SaveManager,

    pageId: "page-character",
    columnsWrapSelectors: ["#charColumns", ".charColumns"],
    col0Selector: "#charCol0",
    col1Selector: "#charCol1",
    panelSelector: "section.panel",

    getUiState: (s) => {
      if (!s || !s.character) return null;
      if (!s.character.ui) s.character.ui = {};
      return s.character.ui;
    },

    // Character-specific: panels sometimes start as <section><h2>...</h2>...</section>
    // We normalize to a header row to host the move buttons.
    ensureHeaderRow: (panelEl) => {
      if (!panelEl) return null;

      const existing =
        panelEl.querySelector(":scope > .panelHeader") ||
        panelEl.querySelector(":scope > .row") ||
        panelEl.querySelector(":scope > .panelTop") ||
        panelEl.querySelector(":scope > .sessionHeader") ||
        panelEl.querySelector(":scope > .npcHeader") ||
        panelEl.querySelector(":scope > .partyHeader") ||
        panelEl.querySelector(":scope > .locHeader");

      if (existing) return existing;

      const h2 = panelEl.querySelector(":scope > h2");
      if (h2) {
        const wrap = document.createElement("div");
        wrap.className = "panelHeader";
        panelEl.insertBefore(wrap, h2);
        wrap.appendChild(h2);
        return wrap;
      }

      return null;
    },

    // Expose a stable hook used by modules that need to re-apply stored order.
    storeApplyFnKey: "_applySectionOrder",
  });
}
