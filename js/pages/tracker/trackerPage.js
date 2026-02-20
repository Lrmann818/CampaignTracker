// @ts-nocheck
// js/pages/tracker/trackerPage.js — page-level wiring for the main Tracker view
//
// This keeps app.js as a composition root and groups Tracker-specific DOM wiring
// (title, misc textarea, section reorder, sessions/npcs/party/locations sheets).

import { setupTrackerSectionReorder } from "./trackerSectionReorder.js";
import { setupCharacterSectionReorder } from "../character/characterSectionReorder.js";
import { initSessionsUI } from "./panels/sessions.js";
import { initNpcsUI } from "./panels/npcCards.js";
import { initPartyUI, renderPartyCards as renderPartyCardsUI } from "./panels/partyCards.js";
import { initLocationsUI, renderLocationCards as renderLocationCardsUI } from "./panels/locationCards.js";
import { initCharacterPageUI } from "../character/characterPage.js";
import { initSpellsPanelUI } from "../character/panels/spellsPanel.js";
import { initPanelHeaderCollapse } from "../../ui/panelHeaderCollapse.js";
import { bindText, bindContentText } from "../../ui/bindings.js";

export function initTrackerPage(deps) {
  const {
    state,
    SaveManager,
    Popovers,

    // dialogs
    uiPrompt,
    uiAlert,
    uiConfirm,

    // status
    setStatus,

    // domain + helpers
    makeNpc,
    makePartyMember,
    makeLocation,
    enhanceNumberSteppers,
    numberOrNull,

    // portraits/images
    pickCropStorePortrait,
    ImagePicker,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    blobIdToObjectUrl,

    // character sheet text storage
    textKey_spellNotes,
    putText,
    getText,
    deleteText,

    // character sheet autosize
    autoSizeInput,
  } = deps || {};

  if (!state) throw new Error("initTrackerPage: state is required");
  if (!SaveManager) throw new Error("initTrackerPage: SaveManager is required");

  // ----- Campaign title -----
  bindContentText({
    id: "campaignTitle",
    get: () => state.tracker.campaignTitle || "My Campaign",
    set: (raw) => {
      const normalized = String(raw ?? "").replace(/\s+/g, " ").trim();
      state.tracker.campaignTitle = normalized || "My Campaign";
    },
    SaveManager,
  });

  // ----- Simple textareas -----
  ["misc"].forEach((id) => {
    bindText({
      id,
      get: () => state.tracker[id],
      set: (value) => {
        state.tracker[id] = value;
      },
      SaveManager,
    });
  });

  // ----- Tracker section reordering (panels) -----
  setupTrackerSectionReorder({ state, SaveManager });

  // ----- Sessions UI -----
  initSessionsUI({
    state,
    tabsEl: document.getElementById("sessionTabs"),
    notesBox: document.getElementById("sessionNotesBox"),
    searchEl: document.getElementById("sessionSearch"),
    addBtn: document.getElementById("addSessionBtn"),
    renameBtn: document.getElementById("renameSessionBtn"),
    deleteBtn: document.getElementById("deleteSessionBtn"),
    SaveManager,
    uiPrompt,
    uiAlert,
    uiConfirm,
  });

  // ----- Cards UIs -----
  initNpcsUI({
    state,
    SaveManager,
    Popovers,
    uiPrompt,
    uiAlert,
    uiConfirm,
    setStatus,
    makeNpc,
    enhanceNumberSteppers,
    numberOrNull,
    pickCropStorePortrait,
    ImagePicker,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    blobIdToObjectUrl,
    autoSizeInput,
  });

  const partyApi = initPartyUI({
    state,
    SaveManager,
    Popovers,
    uiPrompt,
    uiAlert,
    uiConfirm,
    makePartyMember,
    enhanceNumberSteppers,
    numberOrNull,
    pickCropStorePortrait,
    ImagePicker,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    setStatus,
    blobIdToObjectUrl,
    autoSizeInput,
  });

  initLocationsUI({
    state,
    SaveManager,
    Popovers,
    uiPrompt,
    uiAlert,
    uiConfirm,
    makeLocation,
    pickCropStorePortrait,
    ImagePicker,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    setStatus,
    blobIdToObjectUrl,
    autoSizeInput,
  });

  // ----- Character sheet UI -----
  initCharacterPageUI({
    state,
    SaveManager,
    Popovers,
    ImagePicker,
    pickCropStorePortrait,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    blobIdToObjectUrl,
    textKey_spellNotes,
    putText,
    getText,
    deleteText,
    autoSizeInput,
    enhanceNumberSteppers,
    uiAlert,
    uiConfirm,
    uiPrompt,
    setStatus,
  });
  
  // Runs after the Tracker + Character DOM is present.
  initPanelHeaderCollapse({ state, SaveManager });

  enhanceNumberSteppers(document);
}
