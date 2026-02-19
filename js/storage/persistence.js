// @ts-nocheck
// js/storage/persistence.js — load + migrate + exit-safety helpers
//
// Keeps app.js slimmer and makes persistence logic reusable/testable.
//
// - loadAll(): loads from localStorage, runs migrateState(), then performs
//   legacy image migrations (dataUrl -> IndexedDB blobs) and map-manager folding.
// - installExitSave(): best-effort flush on tab close/background.

/**
 * Save the app state to localStorage.
 *
 * NOTE: Undo/redo are in-memory only and are intentionally excluded.
 */
export function saveAllLocal(opts) {
  const { storageKey, state, currentSchemaVersion } = opts || {};

  if (!storageKey) throw new Error("saveAllLocal: storageKey is required");
  if (!state) throw new Error("saveAllLocal: state is required");

  // Persist only serializable state. Undo/redo are in-memory only.
  const serializableMap = { ...(state.map || {}) };
  delete serializableMap.undo;
  delete serializableMap.redo;

  const payload = {
    schemaVersion: state.schemaVersion ?? currentSchemaVersion,
    tracker: state.tracker,
    character: state.character,
    map: serializableMap,
    ui: state.ui
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn("Save failed:", err);
    return false;
  }
}

export async function loadAll(opts) {
  const {
    storageKey,
    state,
    migrateState,
    ensureMapManager,
    dataUrlToBlob,
    putBlob,
    setStatus,
    markDirty
  } = opts || {};

  if (!storageKey) throw new Error("loadAll: storageKey is required");
  if (!state) throw new Error("loadAll: state is required");
  if (typeof migrateState !== "function") throw new Error("loadAll: migrateState() is required");
  if (typeof ensureMapManager !== "function") throw new Error("loadAll: ensureMapManager() is required");
  if (typeof dataUrlToBlob !== "function") throw new Error("loadAll: dataUrlToBlob() is required");
  if (typeof putBlob !== "function") throw new Error("loadAll: putBlob() is required");
  if (typeof setStatus !== "function") throw new Error("loadAll: setStatus() is required");
  if (typeof markDirty !== "function") throw new Error("loadAll: markDirty() is required");

  const raw = localStorage.getItem(storageKey);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    const migrated = migrateState(parsed);

    state.schemaVersion = migrated.schemaVersion;
    // Keep existing object references where possible (most code reads from state directly),
    // but Object.assign is safer than replacing whole objects.
    Object.assign(state.tracker, migrated.tracker || {});
    Object.assign(state.character, migrated.character || {});
    Object.assign(state.map, migrated.map || {});

    // Restore root UI (theme, textarea heights)
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    Object.assign(state.ui, migrated.ui || {});

    // Ensure undo/redo start empty (in-memory only)
    state.map.undo = [];
    state.map.redo = [];

    // ---- MIGRATION: imgDataUrl -> IndexedDB blobId ----
    // NPCs
    for (const npc of (state.tracker.npcs || [])) {
      if (npc.imgDataUrl && !npc.imgBlobId) {
        const blob = dataUrlToBlob(npc.imgDataUrl);
        try {
          npc.imgBlobId = await putBlob(blob);
          delete npc.imgDataUrl;
        } catch (err) {
          console.warn("Migration: failed to store NPC image blob:", err);
          setStatus("Storage is full. Some images couldn't be migrated. Export a backup.");
        }
      }
    }

    // Party
    for (const m of (state.tracker.party || [])) {
      if (m.imgDataUrl && !m.imgBlobId) {
        const blob = dataUrlToBlob(m.imgDataUrl);
        try {
          m.imgBlobId = await putBlob(blob);
          delete m.imgDataUrl;
        } catch (err) {
          console.warn("Migration: failed to store party image blob:", err);
          setStatus("Storage is full. Some images couldn't be migrated. Export a backup.");
        }
      }
    }

    // Locations
    for (const loc of (state.tracker.locationsList || [])) {
      if (loc.imgDataUrl && !loc.imgBlobId) {
        const blob = dataUrlToBlob(loc.imgDataUrl);
        try {
          loc.imgBlobId = await putBlob(blob);
          delete loc.imgDataUrl;
        } catch (err) {
          console.warn("Migration: failed to store location image blob:", err);
          setStatus("Storage is full. Some images couldn't be migrated. Export a backup.");
        }
      }
    }

    // Map (legacy -> multi-map)
    ensureMapManager();

    const defaultMap =
      state.map.maps?.find(m => m.id === state.map.activeMapId) ||
      state.map.maps?.[0];

    // Fold legacy top-level map fields into the default map entry
    if (defaultMap) {
      // Legacy: data URLs
      if (state.map.bgDataUrl && !defaultMap.bgBlobId) {
        try {
          const blob = dataUrlToBlob(state.map.bgDataUrl);
          defaultMap.bgBlobId = await putBlob(blob);
          delete state.map.bgDataUrl;
        } catch (err) {
          console.warn("Migration: failed to store map background blob:", err);
          setStatus("Storage is full or map image is corrupted. Some images couldn't be migrated. Export a backup.");
        }
      }

      if (state.map.drawingDataUrl && !defaultMap.drawingBlobId) {
        try {
          const blob = dataUrlToBlob(state.map.drawingDataUrl);
          defaultMap.drawingBlobId = await putBlob(blob);
          delete state.map.drawingDataUrl;
        } catch (err) {
          console.warn("Migration: failed to store map drawing blob:", err);
          setStatus("Storage is full or map image is corrupted. Some images couldn't be migrated. Export a backup.");
        }
      }

      // Legacy: blob ids stored at top-level
      if (state.map.bgBlobId && !defaultMap.bgBlobId) {
        defaultMap.bgBlobId = state.map.bgBlobId;
        delete state.map.bgBlobId;
      }
      if (state.map.drawingBlobId && !defaultMap.drawingBlobId) {
        defaultMap.drawingBlobId = state.map.drawingBlobId;
        delete state.map.drawingBlobId;
      }

      // Legacy: per-map settings stored at top-level
      if (typeof state.map.brushSize === "number" && (defaultMap.brushSize == null)) {
        defaultMap.brushSize = state.map.brushSize;
        delete state.map.brushSize;
      }
      if (typeof state.map.colorKey === "string" && !defaultMap.colorKey) {
        defaultMap.colorKey = state.map.colorKey;
        delete state.map.colorKey;
      }
    }

    // Fix a common typo from older builds
    if (state.tracker?.ui?.textareaHeigts && !state.tracker.ui.textareaHeights) {
      state.tracker.ui.textareaHeights = state.tracker.ui.textareaHeigts;
    }

    // If we touched anything, ensure we write the migrated state back.
    markDirty();
    return true;
  } catch (err) {
    console.error("Load/migration failed:", err);
    setStatus("Loaded with issues. Consider exporting a backup.");
    return false;
  }
}

export function installExitSave(SaveManager) {
  if (!SaveManager || typeof SaveManager.flush !== "function" || typeof SaveManager.getStatus !== "function") {
    throw new Error("installExitSave: SaveManager with flush() and getStatus() is required");
  }

  // Best-effort: try to flush when the page is backgrounded or closed.
  // beforeunload is the only hook that *may* show a confirmation if unsaved.
  const handler = (e) => {
    const st = SaveManager.getStatus();
    if (st?.dirty) {
      try { SaveManager.flush(); } catch (_) {}
      // Trigger the native "Leave site?" prompt (message ignored by most browsers).
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
    return undefined;
  };

  const backgroundFlush = () => {
    const st = SaveManager.getStatus();
    if (st?.dirty) {
      try { SaveManager.flush(); } catch (_) {}
    }
  };

  window.addEventListener("beforeunload", handler);
  window.addEventListener("pagehide", backgroundFlush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") backgroundFlush();
  });

  return () => {
    window.removeEventListener("beforeunload", handler);
    window.removeEventListener("pagehide", backgroundFlush);
    // visibilitychange removal would require the same fn ref; keep it simple for now.
  };
}
