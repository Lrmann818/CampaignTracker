// @ts-nocheck
// js/pages/tracker/trackerSectionReorder.js

import { setupPagePanelReorder } from "../../ui/pagePanelReorder.js";

export function setupTrackerSectionReorder({ state, SaveManager }) {
  return setupPagePanelReorder({
    state,
    SaveManager,

    pageId: "page-tracker",
    columnsWrapSelectors: ["#trackerColumns", ".trackerColumns"],
    col0Selector: "#trackerCol0",
    col1Selector: "#trackerCol1",
    panelSelector: ".panel",

    getUiState: (s) => {
      if (!s || !s.tracker) return null;
      if (!s.tracker.ui) s.tracker.ui = {};
      return s.tracker.ui;
    },

    // Tracker-specific: the move buttons must go into existing control rows.
    getHeaderEl: (panelId, trackerPage) => {
      switch (panelId) {
        case "sessionPanel":    return trackerPage.querySelector("#sessionPanel .sessionControls");
        case "npcPanel":        return trackerPage.querySelector("#npcPanel .npcControls");
        case "partyPanel":      return trackerPage.querySelector("#partyPanel .partyControls");
        case "locationsPanel":  return trackerPage.querySelector("#locationsPanel .locControls");
        case "miscPanel":       return trackerPage.querySelector("#miscPanel .panelHeader");
        default:                return null;
      }
    },
  });
}