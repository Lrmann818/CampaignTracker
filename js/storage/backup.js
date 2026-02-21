// @ts-nocheck
// js/storage/backup.js — import/export/reset local backups
//
// NOTE: This module is dependency-injected so it can be used from app.js
// without creating circular imports.

import { uiAlert, uiConfirm } from "../ui/dialogs.js";

const MAX_BACKUP_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_BLOBS = 200;

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isSafeImageDataUrl(s) {
  return typeof s === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(s);
}

function validateIncomingStateShape(state) {
  if (!isPlainObject(state)) throw new Error("Backup state must be an object.");

  if (Object.prototype.hasOwnProperty.call(state, "schemaVersion") && !Number.isFinite(state.schemaVersion)) {
    throw new Error("Backup state.schemaVersion must be a number.");
  }
  if (Object.prototype.hasOwnProperty.call(state, "tracker") && !isPlainObject(state.tracker)) {
    throw new Error("Backup state.tracker must be an object.");
  }
  if (Object.prototype.hasOwnProperty.call(state, "character") && !isPlainObject(state.character)) {
    throw new Error("Backup state.character must be an object.");
  }
  if (Object.prototype.hasOwnProperty.call(state, "map") && !isPlainObject(state.map)) {
    throw new Error("Backup state.map must be an object.");
  }
  if (Object.prototype.hasOwnProperty.call(state, "ui") && !isPlainObject(state.ui)) {
    throw new Error("Backup state.ui must be an object.");
  }
}

function normalizeIncomingBackup(parsed) {
  if (!isPlainObject(parsed)) throw new Error("Unsupported backup format.");

  if (parsed.version === 2) {
    validateIncomingStateShape(parsed.state);
    const incomingBlobs = parsed.blobs ?? {};
    const incomingTexts = parsed.texts ?? {};
    if (!isPlainObject(incomingBlobs)) throw new Error("Backup blobs must be an object.");
    if (!isPlainObject(incomingTexts)) throw new Error("Backup texts must be an object.");
    return { incomingState: parsed.state, incomingBlobs, incomingTexts };
  }

  if (parsed.version === 1) {
    validateIncomingStateShape(parsed.state);
    return { incomingState: parsed.state, incomingBlobs: {}, incomingTexts: {} };
  }

  if (Object.prototype.hasOwnProperty.call(parsed, "version")) {
    throw new Error("Unsupported backup format.");
  }
  if (Object.prototype.hasOwnProperty.call(parsed, "state")) {
    throw new Error("Unsupported backup format.");
  }

  validateIncomingStateShape(parsed);
  return { incomingState: parsed, incomingBlobs: {}, incomingTexts: {} };
}

export async function exportBackup(deps) {
  const { state, ensureMapManager, getBlob, blobToDataUrl, getAllTexts } = deps;

  // Collect all blob IDs used by state
  const ids = new Set();

  for (const npc of (state.tracker.npcs || [])) if (npc.imgBlobId) ids.add(npc.imgBlobId);
  for (const m of (state.tracker.party || [])) if (m.imgBlobId) ids.add(m.imgBlobId);
  for (const loc of (state.tracker.locationsList || [])) if (loc.imgBlobId) ids.add(loc.imgBlobId);

  ensureMapManager?.();
  for (const mp of (state.map.maps || [])) {
    if (state.character?.imgBlobId) ids.add(state.character.imgBlobId);
    if (mp.bgBlobId) ids.add(mp.bgBlobId);
    if (mp.drawingBlobId) ids.add(mp.drawingBlobId);
  }

  // Turn blobs into dataURLs inside the backup file
  const blobs = {};
  for (const id of ids) {
    try {
      const blob = await getBlob(id);
      if (blob) blobs[id] = await blobToDataUrl(blob);
    } catch (err) {
      console.warn("Skipping image during export (failed to read):", id, err);
    }
  }

  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    state: {
      ...state,
      map: { ...state.map, undo: [], redo: [] }
    },
    blobs,
    texts: await getAllTexts()
  };

  const fileBlob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(fileBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaign-backup-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    a.click();
  } catch (err) {
    console.error("Export download failed:", err);
    await uiAlert("Export failed. Try again, or use a different browser.", { title: "Export failed" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importBackup(e, deps) {
  const {
    state,
    ensureMapManager,
    migrateState,
    saveAll,
    putBlob,
    dataUrlToBlob,
    putText,
    ACTIVE_TAB_KEY,
    STORAGE_KEY,
    afterImport
  } = deps;

  const file = e.target.files?.[0];
  if (!file) return;

  try {
    if (file.size > MAX_BACKUP_BYTES) {
      await uiAlert("Backup file is too large.", { title: "Import failed" });
      e.target.value = "";
      return;
    }

    // Read contents (avoid FileReader 'load' handler blocking warnings)
    let text = "";
    try {
      text = await file.text();
    } catch (err) {
      console.error("Import failed: could not read file:", err);
      await uiAlert("Could not read that file.", { title: "Import failed" });
      e.target.value = "";
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("Import failed: invalid JSON:", err);
      await uiAlert("That file isn't valid JSON.", { title: "Import failed" });
      e.target.value = "";
      return;
    }

    let normalized;
    try {
      normalized = normalizeIncomingBackup(parsed);
    } catch (err) {
      console.error("Import failed: unsupported backup format:", err);
      await uiAlert(err?.message || "Unsupported backup format.", { title: "Import failed" });
      e.target.value = "";
      return;
    }
    const { incomingState, incomingBlobs, incomingTexts } = normalized;

    let migrated;
    try {
      migrated = migrateState(incomingState);
    } catch (err) {
      console.error("Import failed: could not migrate state:", err);
      await uiAlert(err?.message || "Backup state is invalid.", { title: "Import failed" });
      e.target.value = "";
      return;
    }

    const blobEntries = Object.entries(incomingBlobs);
    if (blobEntries.length > MAX_BLOBS) {
      await uiAlert("Backup contains too many images.", { title: "Import failed" });
      e.target.value = "";
      return;
    }
    for (const [, dataUrl] of blobEntries) {
      if (!isSafeImageDataUrl(dataUrl)) {
        await uiAlert("Backup contains an unsupported image format.", { title: "Import failed" });
        e.target.value = "";
        return;
      }
    }

    // Stage blobs/texts first; state is only mutated after all writes succeed.
    // Keep original blob IDs when possible; only remap entries that must fall back.
    const idMap = new Map(); // oldId -> newId (fallback only)
    for (const [oldId, dataUrl] of Object.entries(incomingBlobs)) {
      let blob;
      try {
        blob = dataUrlToBlob(dataUrl);
      } catch (err) {
        console.error("Import failed: corrupt image data for blob:", oldId, err);
        await uiAlert("Import failed: one of the images in this backup is corrupted.", { title: "Import failed" });
        e.target.value = "";
        return;
      }

      try {
        await putBlob(blob, oldId);
      } catch (err) {
        console.warn("Import: failed to preserve blob ID, falling back to remap:", oldId, err);
        try {
          const newId = await putBlob(blob);
          idMap.set(oldId, newId);
        } catch (fallbackErr) {
          console.error("Import failed: could not store image blob:", oldId, fallbackErr);
          await uiAlert("Import failed while saving images.", { title: "Import failed" });
          e.target.value = "";
          return;
        }
      }
    }

    // Restore texts (same ids)
    for (const [tid, tval] of Object.entries(incomingTexts)) {
      await putText(tval, tid);
    }

    if (idMap.size > 0) {
      const remap = (id) => (id ? (idMap.get(id) || id) : id);
      if (Array.isArray(migrated?.tracker?.npcs)) {
        for (const npc of migrated.tracker.npcs) if (npc?.imgBlobId) npc.imgBlobId = remap(npc.imgBlobId);
      }
      if (Array.isArray(migrated?.tracker?.party)) {
        for (const m of migrated.tracker.party) if (m?.imgBlobId) m.imgBlobId = remap(m.imgBlobId);
      }
      if (Array.isArray(migrated?.tracker?.locationsList)) {
        for (const loc of migrated.tracker.locationsList) if (loc?.imgBlobId) loc.imgBlobId = remap(loc.imgBlobId);
      }
      if (Array.isArray(migrated?.map?.maps)) {
        for (const mp of migrated.map.maps) {
          if (mp?.bgBlobId) mp.bgBlobId = remap(mp.bgBlobId);
          if (mp?.drawingBlobId) mp.drawingBlobId = remap(mp.drawingBlobId);
        }
      }
      if (migrated?.character?.imgBlobId) migrated.character.imgBlobId = remap(migrated.character.imgBlobId);
    }

    // Restore state (with migrations and remapped blob IDs)
    state.schemaVersion = migrated.schemaVersion;
    Object.assign(state.tracker, migrated.tracker || {});
    Object.assign(state.character, migrated.character || {});
    Object.assign(state.map, migrated.map || {});

    // restore root UI (theme, textarea heights)
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    Object.assign(state.ui, migrated.ui || {});

    ensureMapManager?.();

    // Persist + active tab
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    try { localStorage.setItem(ACTIVE_TAB_KEY, state.ui?.activeTab || "tracker"); } catch (_) {}

    try { saveAll?.(); } catch (err) { console.warn("saveAll hook failed:", err); }

    // Update UI immediately (optional hook from app.js)
    try { await afterImport?.(); } catch (err) { console.warn("afterImport hook failed:", err); }

    if (blobEntries.length === 0) {
      try {
        await uiAlert("This backup did not include images. Existing portraits were kept.", { title: "Import complete" });
      } catch (err) {
        console.warn("import complete notice failed:", err);
      }
    }

    // success
    e.target.value = "";
  } catch (err) {
    console.error("Import failed:", err);
    await uiAlert("Import failed due to an unexpected error.", { title: "Import failed" });
    e.target.value = "";
  }
}

export async function resetAll(deps) {
  const {
    ACTIVE_TAB_KEY,
    STORAGE_KEY,
    clearAllBlobs,
    clearAllTexts,
    // Optional: best-effort flush + status before wiping
    flush,
    setStatus
  } = deps;

  const ok = await uiConfirm(
    "Reset everything? This clears your local saved data (including images and large notes)."
  );
  if (!ok) return;

  try {
    setStatus?.("Resetting...");
    // Best effort: if something is dirty, try to write one last time.
    await flush?.();
  } catch (e) {
    // Not fatal — we're about to wipe anyway.
    console.warn("resetAll: flush failed (continuing).", e);
  }

  try {
    localStorage.removeItem(ACTIVE_TAB_KEY);
    localStorage.removeItem(STORAGE_KEY);
    await clearAllBlobs();
    await clearAllTexts();
  } catch (e) {
    console.error("resetAll: wipe failed", e);
    await uiAlert("Reset failed. Check the console for details.");
    return;
  }

  // Reload into clean defaults.
  location.reload();
}
