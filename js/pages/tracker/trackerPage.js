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
import { requireMany, getNoopDestroyApi } from "../../utils/domGuards.js";
import { DEV_MODE } from "../../utils/dev.js";

let _activeTrackerPageController = null;
const _singletonTrackerPanelInits = {
  npcs: false,
  party: false,
  locations: false
};

export function initTrackerPage(deps) {
  _activeTrackerPageController?.destroy?.();
  _activeTrackerPageController = null;

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

  const guard = requireMany(
    { root: "#page-tracker" },
    {
      root: document,
      setStatus,
      context: "Tracker page",
      stickyMs: 5000
    }
  );
  if (!guard.ok) {
    return guard.destroy;
  }

  const destroyFns = [];
  const addDestroy = (destroyFn) => {
    if (typeof destroyFn === "function") destroyFns.push(destroyFn);
  };
  const listenerController = new AbortController();
  const listenerSignal = listenerController.signal;
  addDestroy(() => listenerController.abort());

  const addListener = (target, type, handler, options) => {
    if (!target || typeof target.addEventListener !== "function") return;
    const listenerOptions =
      typeof options === "boolean"
        ? { capture: options }
        : (options || {});
    target.addEventListener(type, handler, { ...listenerOptions, signal: listenerSignal });
  };

  const runPanelInit = (panelName, initFn, { singletonKey } = {}) => {
    if (singletonKey && _singletonTrackerPanelInits[singletonKey]) {
      return getNoopDestroyApi();
    }

    try {
      const panelApi = initFn();
      if (panelApi?.destroy) addDestroy(() => panelApi.destroy());
      else if (singletonKey) _singletonTrackerPanelInits[singletonKey] = true;
      return panelApi || getNoopDestroyApi();
    } catch (err) {
      console.error(`${panelName} init failed:`, err);
      if (typeof setStatus === "function") {
        const message = DEV_MODE
          ? `${panelName} failed in DEV mode. Check console for details.`
          : `${panelName} failed to initialize. Check console for details.`;
        setStatus(message, { stickyMs: 5000 });
      }
      return getNoopDestroyApi();
    }
  };

  // ----- Campaign title -----
  const campaignTitleEl = document.getElementById("campaignTitle");
  if (campaignTitleEl) {
    campaignTitleEl.textContent = state.tracker.campaignTitle || "My Campaign";
    addListener(campaignTitleEl, "input", () => {
      const raw = campaignTitleEl.textContent ?? "";
      const normalized = String(raw ?? "").replace(/\s+/g, " ").trim();
      state.tracker.campaignTitle = normalized || "My Campaign";
      SaveManager.markDirty();
    });
  }

  // ----- Simple textareas -----
  ["misc"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state.tracker[id] ?? "";
    addListener(el, "input", () => {
      state.tracker[id] = el.value;
      SaveManager.markDirty();
    });
  });

  // ----- Tracker section reordering (panels) -----
  runPanelInit("Tracker section reordering", () => setupTrackerSectionReorder({ state, SaveManager }));

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
  }), { singletonKey: "npcs" });

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
  }), { singletonKey: "party" });

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
  }), { singletonKey: "locations" });

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

  const api = {
    destroy() {
      for (let i = destroyFns.length - 1; i >= 0; i--) {
        destroyFns[i]?.();
      }
      if (_activeTrackerPageController === api) {
        _activeTrackerPageController = null;
      }
    }
  };

  _activeTrackerPageController = api;
  return api;
}
