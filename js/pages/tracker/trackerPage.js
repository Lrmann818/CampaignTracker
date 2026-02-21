// @ts-nocheck
// js/pages/tracker/trackerPage.js — page-level wiring for the main Tracker view
//
// This keeps app.js as a composition root and groups Tracker-specific DOM wiring
// (title, misc textarea, section reorder, sessions/npcs/party/locations sheets).

import { setupTrackerSectionReorder } from "./trackerSectionReorder.js";
import { initSessionsPanel } from "./panels/sessions.js";
import { initNpcsPanel } from "./panels/npcCards.js";
import { initPartyPanel } from "./panels/partyCards.js";
import { initLocationsPanel } from "./panels/locationCards.js";
import { initCharacterPageUI } from "../character/characterPage.js";
import { initPanelHeaderCollapse } from "../../ui/panelHeaderCollapse.js";
import { bindText, bindContentText } from "../../ui/bindings.js";
import { requireEl, getNoopDestroyApi } from "../../utils/domGuards.js";

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
  if (!setStatus) throw new Error("initTrackerPage requires setStatus");

  const trackerRoot = requireEl("#page-tracker", document, { prefix: "initTrackerPage", warn: false });
  if (!trackerRoot) {
    setStatus("Tracker page unavailable (missing #page-tracker).");
    return;
  }

  const runPanelInit = (panelName, initFn) => {
    try {
      return initFn();
    } catch (err) {
      console.error(`${panelName} init failed:`, err);
      setStatus(`${panelName} failed to initialize. Check console for details.`);
      return getNoopDestroyApi();
    }
  };

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
  runPanelInit("Sessions panel", () => initSessionsPanel({
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
    setStatus,
  }));

  // ----- Cards UIs -----
  runPanelInit("NPCs panel", () => initNpcsPanel({
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
  }));

  runPanelInit("Party panel", () => initPartyPanel({
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
  }));

  runPanelInit("Locations panel", () => initLocationsPanel({
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
  }));

  // ----- Character sheet UI -----
  runPanelInit("Character page", () => initCharacterPageUI({
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
  }));
  
  // Runs after the Tracker + Character DOM is present.
  runPanelInit("Panel collapse wiring", () => initPanelHeaderCollapse({ state, SaveManager, setStatus }));

  runPanelInit("Number steppers", () => enhanceNumberSteppers(document));
}
