// @ts-check
// js/pages/tracker/trackerSectionReorder.js

import { setupPagePanelReorder } from "../../ui/pagePanelReorder.js";

/** @typedef {{ sectionOrder?: string[] }} TrackerPanelOrderUiState */
/** @typedef {{ ui?: TrackerPanelOrderUiState | undefined }} TrackerSectionUiState */
/** @typedef {{ tracker?: TrackerSectionUiState | undefined }} TrackerSectionReorderState */
/** @typedef {{ markDirty?: () => void }} SaveManagerLike */
/**
 * @typedef {{
 *   state?: TrackerSectionReorderState,
 *   SaveManager?: SaveManagerLike
 * }} TrackerSectionReorderDeps
 */

/**
 * @param {Element | null} value
 * @returns {HTMLElement | null}
 */
function asHtmlElement(value) {
  return value instanceof HTMLElement ? value : null;
}

/**
 * @param {string} panelId
 * @returns {string | null}
 */
function getTrackerHeaderSelector(panelId) {
  switch (panelId) {
    case "sessionPanel": return "#sessionPanel .sessionControls";
    case "npcPanel": return "#npcPanel .npcControls";
    case "partyPanel": return "#partyPanel .partyControls";
    case "locationsPanel": return "#locationsPanel .locControls";
    case "miscPanel": return "#miscPanel .panelHeader";
    default: return null;
  }
}

/**
 * @param {string} panelId
 * @param {HTMLElement} trackerPage
 * @returns {HTMLElement | null}
 */
function findTrackerHeaderEl(panelId, trackerPage) {
  const selector = getTrackerHeaderSelector(panelId);
  return selector ? asHtmlElement(trackerPage.querySelector(selector)) : null;
}

/**
 * @param {unknown} value
 * @returns {TrackerSectionReorderState | null}
 */
function asTrackerSectionReorderState(value) {
  return value && typeof value === "object"
    ? /** @type {TrackerSectionReorderState} */ (value)
    : null;
}

/**
 * @param {TrackerSectionReorderDeps} [deps]
 * @returns {ReturnType<typeof setupPagePanelReorder>}
 */
export function setupTrackerSectionReorder({ state, SaveManager } = {}) {
  return setupPagePanelReorder({
    state,
    SaveManager,

    pageId: "page-tracker",
    columnsWrapSelectors: ["#trackerColumns", ".trackerColumns"],
    col0Selector: "#trackerCol0",
    col1Selector: "#trackerCol1",
    panelSelector: ".panel",

    getUiState: (s) => {
      const reorderState = asTrackerSectionReorderState(s);
      if (!reorderState?.tracker) return null;
      if (!reorderState.tracker.ui) reorderState.tracker.ui = {};
      return reorderState.tracker.ui;
    },

    // Tracker-specific: the move buttons must go into existing control rows.
    getHeaderEl: (panelId, trackerPage) => {
      return findTrackerHeaderEl(panelId, trackerPage);
    },
  });
}
