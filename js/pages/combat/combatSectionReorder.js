// @ts-check
// js/pages/combat/combatSectionReorder.js

import { setupPagePanelReorder } from "../../ui/pagePanelReorder.js";

/** @typedef {{ panelOrder?: string[] }} CombatWorkspaceLayoutState */
/** @typedef {{ workspace?: CombatWorkspaceLayoutState | undefined }} CombatStateWithWorkspace */
/** @typedef {{ combat?: CombatStateWithWorkspace | undefined }} CombatSectionReorderState */
/** @typedef {{ markDirty?: () => void }} SaveManagerLike */
/**
 * @typedef {{
 *   state?: CombatSectionReorderState,
 *   SaveManager?: SaveManagerLike,
 *   setStatus?: (message: string, opts?: { stickyMs?: number }) => void
 * }} CombatSectionReorderDeps
 */

/**
 * @param {Element | null} value
 * @returns {HTMLElement | null}
 */
function asHtmlElement(value) {
  return value instanceof HTMLElement ? value : null;
}

/**
 * @param {unknown} value
 * @returns {CombatSectionReorderState | null}
 */
function asCombatSectionReorderState(value) {
  return value && typeof value === "object"
    ? /** @type {CombatSectionReorderState} */ (value)
    : null;
}

/**
 * @param {CombatSectionReorderDeps} [deps]
 * @returns {ReturnType<typeof setupPagePanelReorder>}
 */
export function setupCombatSectionReorder({ state, SaveManager, setStatus } = {}) {
  return setupPagePanelReorder({
    state,
    SaveManager,
    setStatus,

    pageId: "page-combat",
    columnsWrapSelectors: ["#combatColumns", ".combatColumns"],
    col0Selector: "#combatCol0",
    col1Selector: "#combatCol1",
    panelSelector: "section.combatPanel",
    orderKey: "panelOrder",

    getUiState: (s) => {
      const reorderState = asCombatSectionReorderState(s);
      if (!reorderState?.combat?.workspace) return null;
      return reorderState.combat.workspace;
    },

    ensureHeaderRow: (panelEl) => {
      return asHtmlElement(panelEl.querySelector(":scope > .panelHeader"));
    },
  });
}
