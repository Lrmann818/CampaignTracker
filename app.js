// @ts-nocheck

/************************ Phase 1: split into modules ************************
 * This file is now an ES module. Your index.html must load it like:
 *   <script type="module" src="app.js"></script>
 *
 * Extracted modules:
 *   ./js/state.js
 *   ./js/storage/blobs.js
 *   ./js/storage/texts-idb.js
 *   ./js/storage/backup.js
 ***************************************************************************/

import {
  STORAGE_KEY,
  ACTIVE_TAB_KEY,
  CURRENT_SCHEMA_VERSION,
  state,
  migrateState,
  ensureMapManager,
  getActiveMap,
  newMapEntry
} from "./js/state.js";

import {
  newBlobId,
  putBlob,
  getBlob,
  deleteBlob,
  blobIdToObjectUrl,
  dataUrlToBlob,
  blobToDataUrl,
  clearAllBlobs
} from "./js/storage/blobs.js";

import {
  textKey_spellNotes,
  putText,
  getText,
  deleteText,
  clearAllTexts,
  getAllTexts
} from "./js/storage/texts-idb.js";

import {
  exportBackup as _exportBackup,
  importBackup as _importBackup,
  resetAll as _resetAll
} from "./js/storage/backup.js";
import { createSaveManager } from "./js/storage/saveManager.js";
import { loadAll as loadAllPersist, installExitSave, saveAllLocal } from "./js/storage/persistence.js";


import {
  autoSizeInput,
  autosizeAllNumbers,
  applyAutosize,
  setupTextareaSizing
} from "./js/features/autosize.js";

import { cropImageModal, getPortraitAspect } from "./js/features/imageCropper.js";
import { createFilePicker } from "./js/features/imagePicker.js";
import { pickCropStorePortrait } from "./js/features/portraitFlow.js";

import { enhanceNumberSteppers } from "./js/features/numberSteppers.js";
import { numberOrNull } from "./js/utils/number.js";
import { makeId, makeNpc, makePartyMember, makeLocation } from "./js/domain/factories.js";
import { positionMenuOnScreen } from "./js/ui/positioning.js";
import { createStatus } from "./js/ui/status.js";

import { initDialogs, uiAlert, uiConfirm, uiPrompt } from "./js/ui/dialogs.js";
import { initTopTabsNavigation } from "./js/ui/navigation.js";
import { createPopoverManager } from "./js/ui/popovers.js";
import { initTopbarUI } from "./js/ui/topbar/topbar.js";
import { createThemeManager } from "./js/ui/theme.js";

import { setupSettingsPanel } from "./js/ui/settingsPanel.js";
import { initTrackerPage } from "./js/pages/tracker/trackerPage.js";

import { setupMapPage } from "./js/pages/map/mapPage.js";

// Status line + global error surface
const StatusApi = {
  setStatus: () => { },
  installGlobalErrorHandlers: () => { }
};

/************************ Shared file picker ************************/
// One hidden <input type="file"> for the whole app.
const ImagePicker = createFilePicker({ accept: "image/*" });

// Local persistence (kept as a tiny wrapper for SaveManager + autosize integration)
const saveAll = () => saveAllLocal({
  storageKey: STORAGE_KEY,
  state,
  currentSchemaVersion: CURRENT_SCHEMA_VERSION
});

// ---------- Save Manager (debounced + queued) ----------
const SaveManager = createSaveManager({
  saveAll,
  setStatus: (...args) => StatusApi.setStatus(...args),
  debounceMs: 250,
  savedText: "Saved locally.",
  dirtyText: "Unsaved changes",
  savingText: "Saving...",
  errorText: "Save failed (local). Export a backup."
});

// Best-effort: try to flush on tab close / background.
installExitSave(SaveManager);
// Centralized popover/dropdown manager (outside click, escape, resize reposition)
// Uses the shared positioning helper below (function declaration hoists).
const Popovers = createPopoverManager({
  positionFn: (menu, anchor, opts) => positionMenuOnScreen(menu, anchor, opts)
});

// Theme manager (system/light/dark + named themes)
const Theme = createThemeManager({
  state
});

// Disable autocomplete globally (prevent password managers from hijacking our custom dialogs)
function disableAutocompleteGlobally(root = document) {
  const fields = root.querySelectorAll('input, textarea, select');
  fields.forEach(el => {
    el.setAttribute('autocomplete', 'off');
  });
}

/************************ Boot ***********************/
(async () => {
  const Status = createStatus({ statusEl: document.getElementById("statusText") });
  StatusApi.setStatus = Status.setStatus;
  StatusApi.installGlobalErrorHandlers = Status.installGlobalErrorHandlers;
  StatusApi.installGlobalErrorHandlers();

  await loadAllPersist({
    storageKey: STORAGE_KEY,
    state,
    migrateState,
    ensureMapManager,
    dataUrlToBlob,
    putBlob,
    setStatus: StatusApi.setStatus,
    markDirty: SaveManager.markDirty
  });
  // Wire CSP-safe modal dialogs (replaces window.confirm/prompt)
  initDialogs();
  Theme.initFromState();
  initTopTabsNavigation({
    state,
    markDirty: () => SaveManager.markDirty(),
    activeTabStorageKey: ACTIVE_TAB_KEY
  });
  setupSettingsPanel({
    state,
    storageKeys: { STORAGE_KEY, ACTIVE_TAB_KEY },
    applyTheme: Theme.applyTheme,
    markDirty: () => SaveManager.markDirty(),
    flush: () => SaveManager.flush(),
    Popovers,

    // Backups/reset are dependency-injected; bind the deps here so UI can call them with no args.
    exportBackup: () => _exportBackup({
      state,
      ensureMapManager,
      getBlob,
      blobToDataUrl,
      getAllTexts
    }),
    importBackup: (e) => _importBackup(e, {
      state,
      ensureMapManager,
      migrateState,
      saveAll,
      putBlob,
      dataUrlToBlob,
      clearAllBlobs,
      clearAllTexts,
      putText,
      ACTIVE_TAB_KEY,
      STORAGE_KEY,
      afterImport: async () => {
        // simplest + safest: refresh the UI after importing
        try { location.reload(); } catch (_) { }
      }
    }),
    resetAll: () => _resetAll({
      ACTIVE_TAB_KEY,
      STORAGE_KEY,
      clearAllBlobs,
      clearAllTexts,
      flush: () => SaveManager.flush(),
      setStatus: StatusApi.setStatus
    }),

    clearAllBlobs,
    clearAllTexts,
    setStatus: StatusApi.setStatus
  });
  initTopbarUI({ state, SaveManager, Popovers, positionMenuOnScreen, setStatus: StatusApi.setStatus });
  initTrackerPage({
    state,
    SaveManager,
    Popovers,
    uiPrompt,
    uiAlert,
    uiConfirm,
    setStatus: StatusApi.setStatus,
    makeNpc,
    makePartyMember,
    makeLocation,
    enhanceNumberSteppers,
    numberOrNull,
    pickCropStorePortrait,
    ImagePicker,
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
  });
  autosizeAllNumbers();
  setupTextareaSizing({ state, markDirty: SaveManager.markDirty, saveAll, setStatus: StatusApi.setStatus });
  setupMapPage({ state, SaveManager, setStatus: StatusApi.setStatus, positionMenuOnScreen, Popovers, ensureMapManager, getActiveMap, newMapEntry, blobIdToObjectUrl, putBlob, deleteBlob, uiPrompt, uiAlert, uiConfirm });
  // If migrations or initial setup changed state, persist once, then show clean status.
  await SaveManager.flush();
  SaveManager.init();
})();
