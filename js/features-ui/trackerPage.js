// @ts-nocheck
// js/features-ui/trackerPage.js — page-level wiring for the main Tracker view
//
// This keeps app.js as a composition root and groups Tracker-specific DOM wiring
// (title, misc textarea, section reorder, sessions/npcs/party/locations sheets).

import { setupTrackerSectionReorder } from "./trackerSectionReorder.js";
import { setupCharacterSectionReorder } from "./characterSectionReorder.js";
import { initSessionsUI } from "./sessions.js";
import { initNpcsUI } from "./npcCards.js";
import { initPartyUI, renderPartyCards as renderPartyCardsUI } from "./partyCards.js";
import { initLocationsUI, renderLocationCards as renderLocationCardsUI } from "./locationCards.js";
import { initCharacterSheetUI } from "./characterSheet.js";
import { initPanelHeaderCollapse } from "../ui/panelHeaderCollapse.js";

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
  const titleEl = document.getElementById("campaignTitle");
  if (titleEl) {
    titleEl.textContent = state.tracker.campaignTitle || "My Campaign";
    titleEl.addEventListener("input", () => {
      const raw = (titleEl.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      state.tracker.campaignTitle = raw || "My Campaign";
      SaveManager.markDirty();
    });
  }

  // ----- Simple textareas -----
  ["misc"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state.tracker[id] || "";
    el.addEventListener("input", () => {
      state.tracker[id] = el.value;
      SaveManager.markDirty();
    });
  });

  // ----- Tracker section reordering (panels) -----
  setupTrackerSectionReorder({ state, SaveManager });

  // ----- Sessions UI -----
  initSessionsUI({
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
  });

  const partyApi = initPartyUI({
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
  });

  initLocationsUI({
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
  });

  // ----- Character sheet UI -----
  initCharacterSheetUI({
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

  // ----- Panel header click-to-collapse (header stays visible) -----

  // ----- Character section two-column stacking (like Tracker) -----
  setupCharacterSectionReorder({ state, SaveManager });
  // Runs after the Tracker + Character DOM is present.
  initPanelHeaderCollapse({ state, SaveManager });

  enhanceNumberSteppers(document);
}
